import React, { useEffect, useRef } from "react";

const InteractiveGrid = ({ accentColor = "#ff3e3e" }) => {
  const canvasRef = useRef(null);
  const ripplesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Handle resize
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Click ripple trigger
    const handleClick = (e) => {
      ripplesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius: Math.max(width, height) * 1.2,
        speed: 8, // px per frame
        width: 120, // ripple thickness
        opacity: 0.8,
        decay: 0.012
      });
    };

    window.addEventListener("click", handleClick);

    // Estimate Clock Center for the second pulse
    const getClockCenter = () => {
      const isMobile = width <= 1024;
      if (isMobile) {
        return { x: width / 2, y: height * 0.3 };
      } else {
        const baseVal = Math.min(Math.max(96, width * 0.12), 160);
        const x = baseVal * 0.95 + 16 + 74;
        const y = height / 2;
        return { x, y };
      }
    };

    const SPACING = 28;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Update ripples
      ripplesRef.current = ripplesRef.current
        .map((ripple) => {
          ripple.radius += ripple.speed;
          ripple.opacity -= ripple.decay;
          return ripple;
        })
        .filter((ripple) => ripple.opacity > 0 && ripple.radius < ripple.maxRadius);

      const ripples = ripplesRef.current;

      // Group dot drawing to optimize performance
      // Draw static/unmodified dots first in one batch
      ctx.fillStyle = "rgba(40, 40, 40, 0.4)";
      ctx.beginPath();

      const influencedDots = [];

      for (let x = SPACING / 2; x < width; x += SPACING) {
        for (let y = SPACING / 2; y < height; y += SPACING) {
          let hasInfluence = false;
          let totalRippleGlow = 0;

          // Ripples check
          for (let i = 0; i < ripples.length; i++) {
            const ripple = ripples[i];
            const dx = x - ripple.x;
            const dy = y - ripple.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // If the dot is within the ripple wave thickness
            if (dist > ripple.radius - ripple.width && dist < ripple.radius + ripple.width) {
              const diff = Math.abs(dist - ripple.radius);
              const factor = 1 - diff / ripple.width;
              totalRippleGlow += factor * ripple.opacity;
              hasInfluence = true;
            }
          }

          if (hasInfluence) {
            influencedDots.push({ x, y, rippleGlow: Math.min(1, totalRippleGlow) });
          } else {
            // Standard static grid dot
            ctx.rect(x - 0.75, y - 0.75, 1.5, 1.5);
          }
        }
      }

      ctx.fill();

      // Render influenced dots individually with custom colors & sizes
      influencedDots.forEach((dot) => {
        const glow = dot.rippleGlow;
        const radius = 1 + glow * 1.5;

        // Interpolate color from dark gray/translucent to accent color
        ctx.beginPath();
        if (glow > 0.05) {
          // Glow effect (accent color)
          ctx.fillStyle = accentColor;
          ctx.shadowBlur = glow * 8;
          ctx.shadowColor = accentColor;
          ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
          ctx.fill();
          // Reset shadow
          ctx.shadowBlur = 0;
        } else {
          // Standard dark gray highlighted slightly
          ctx.fillStyle = `rgba(144, 144, 144, 0.4)`;
          ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("click", handleClick);
    };
  }, [accentColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        width: "100%",
        height: "100%"
      }}
    />
  );
};

export default InteractiveGrid;
