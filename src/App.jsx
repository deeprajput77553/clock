import React, { useState, useEffect, useRef } from "react";

// Ticks subcomponent for performance & cleaner JSX structure
const DialTicks = ({ radius, isInner }) => {
  return Array.from({ length: 60 }).map((_, i) => {
    const isMajor = i % 5 === 0;
    return (
      <div
        key={i}
        className={isMajor ? "tick major" : "tick"}
        style={{
          transform: `translate(-50%, -50%) rotate(${i * 6}deg) translateY(-${radius}px)`
        }}
      >
        {isMajor && (
          <span className="tick-label">
            {String(i).padStart(2, "0")}
          </span>
        )}
      </div>
    );
  });
};

function App() {
  // ── Clock values State ──
  const [hourText, setHourText] = useState("00");
  const [minText, setMinText] = useState("00");
  const [secText, setSecText] = useState("00");
  const [dayText, setDayText] = useState("");
  const [dateText, setDateText] = useState("");

  // ── Customization State ──
  const [use24h, setUse24h] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [orbsEnabled, setOrbsEnabled] = useState(true);
  const [accentColor, setAccentColor] = useState("#ff3e3e");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Bottom Panel State ──
  const [panelOpen, setPanelOpen] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState("—%");
  const [batteryIconClass, setBatteryIconClass] = useState("fa-solid fa-battery-three-quarters status-icon");
  const [batteryIconColor, setBatteryIconColor] = useState("");
  const [weatherTemp, setWeatherTemp] = useState("—°C");
  const [weatherIconClass, setWeatherIconClass] = useState("fa-solid fa-cloud-sun status-icon");

  // ── Refs ──
  const dialOuterRef = useRef(null);
  const dialInnerRef = useRef(null);
  const dialsContainerRef = useRef(null);
  
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Read config settings inside requestAnimationFrame without recreating callback
  const use24hRef = useRef(use24h);
  const soundEnabledRef = useRef(soundEnabled);
  const lastRenderedSecRef = useRef(-1);

  useEffect(() => {
    use24hRef.current = use24h;
  }, [use24h]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // ── 1. Web Audio Tick Sound ──
  const ensureAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  };

  const playTick = () => {
    if (!soundEnabledRef.current) return;
    try {
      ensureAudio();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04 + 0.01);
    } catch (_) {}
  };

  const playManualTick = () => {
    try {
      ensureAudio();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05 + 0.01);
    } catch (_) {}
  };

  // ── 2. Dials rotation helper ──
  const setDialAngles = (totalSec) => {
    const secsAngle = 90 - (totalSec * 6);
    const minsAngle = 90 - (totalSec / 10);
    if (dialOuterRef.current) {
      dialOuterRef.current.style.transform = `translate(-50%, -50%) rotate(${secsAngle}deg)`;
    }
    if (dialInnerRef.current) {
      dialInnerRef.current.style.transform = `translate(-50%, -50%) rotate(${minsAngle}deg)`;
    }
  };

  // ── 3. Main render ticks loop (rAF) ──
  useEffect(() => {
    const loop = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      const ms = now.getMilliseconds();
      const totalSec = h * 3600 + m * 60 + s + ms / 1000;

      setDialAngles(totalSec);

      let displayH = h;
      if (!use24hRef.current) displayH = h % 12 || 12;

      setHourText(String(displayH).padStart(2, "0"));
      setMinText(String(m).padStart(2, "0"));
      setSecText(String(s).padStart(2, "0"));

      const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      setDayText(DAYS[now.getDay()]);
      setDateText(`${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`);

      if (s !== lastRenderedSecRef.current) {
        playTick();
        lastRenderedSecRef.current = s;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── 4. Battery Status Tracker ──
  useEffect(() => {
    let batteryInstance = null;
    let onLevelChange = null;
    let onChargingChange = null;

    const applyBattery = (battery) => {
      const lvl = Math.round(battery.level * 100);
      setBatteryLevel(lvl + "%");
      
      let icon = "fa-solid fa-battery-three-quarters status-icon";
      let color = "";

      if (battery.charging) {
        icon = "fa-solid fa-battery-bolt status-icon";
        color = "var(--accent)";
      } else if (lvl > 75) {
        icon = "fa-solid fa-battery-full status-icon";
      } else if (lvl > 40) {
        icon = "fa-solid fa-battery-three-quarters status-icon";
      } else if (lvl > 20) {
        icon = "fa-solid fa-battery-quarter status-icon";
        color = "#ffb700";
      } else {
        icon = "fa-solid fa-battery-empty status-icon";
        color = "var(--accent)";
      }

      setBatteryIconClass(icon);
      setBatteryIconColor(color);
    };

    if (navigator.getBattery) {
      navigator.getBattery().then((bat) => {
        batteryInstance = bat;
        applyBattery(bat);

        onLevelChange = () => applyBattery(bat);
        onChargingChange = () => applyBattery(bat);

        bat.addEventListener("levelchange", onLevelChange);
        bat.addEventListener("chargingchange", onChargingChange);
      });
    } else {
      setBatteryLevel("100%");
    }

    return () => {
      if (batteryInstance) {
        if (onLevelChange) batteryInstance.removeEventListener("levelchange", onLevelChange);
        if (onChargingChange) batteryInstance.removeEventListener("chargingchange", onChargingChange);
      }
    };
  }, []);

  // ── 5. Geolocation Weather Fetcher ──
  useEffect(() => {
    const fetchWeather = (lat, lon) => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
        .then((r) => r.json())
        .then((data) => {
          const temp = Math.round(data.current_weather.temperature);
          const code = data.current_weather.weathercode;
          setWeatherTemp(temp + "°C");

          if (code === 0) setWeatherIconClass("fa-solid fa-sun status-icon");
          else if (code <= 3) setWeatherIconClass("fa-solid fa-cloud-sun status-icon");
          else if (code <= 67) setWeatherIconClass("fa-solid fa-cloud-rain status-icon");
          else if (code <= 77) setWeatherIconClass("fa-solid fa-snowflake status-icon");
          else setWeatherIconClass("fa-solid fa-bolt status-icon");
        })
        .catch(() => {
          setWeatherTemp("—°C");
        });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => setWeatherTemp("—°C")
      );
    }
  }, []);

  // Sound handler for interactive icon click (syncs with toggle check)
  const toggleSound = () => {
    ensureAudio();
    const nextSound = !soundEnabled;
    setSoundEnabled(nextSound);
    if (nextSound) playManualTick();
  };

  const handleSettingsToggle = () => {
    setSettingsOpen(!settingsOpen);
  };

  const containerStyle = {
    "--accent": accentColor,
    "--accent-glow": `${accentColor}40`
  };

  return (
    <div className="clock-screen" style={containerStyle}>
      {/* Background elements */}
      <div className="grid-background"></div>
      <div className={`glow-orb ${!orbsEnabled ? "orbs-hidden" : ""}`} id="orb-1"></div>
      <div className={`glow-orb ${!orbsEnabled ? "orbs-hidden" : ""}`} id="orb-2"></div>

      {/* Clock Core Display */}
      <div className="clock-core">
        <div className="hour-display" id="hour-val">{hourText}</div>

        <div className="selection-capsule" id="capsule">
          <span className="capsule-value" id="capsule-min">{minText}</span>
          <span className="capsule-divider"></span>
          <span className="capsule-sec-value" id="capsule-sec">{secText}</span>
        </div>

        {/* Concentric Dial Rings */}
        <div
          className="dials-container"
          id="dials-container"
          ref={dialsContainerRef}
        >
          <div className="dial dial-outer" id="dial-outer" ref={dialOuterRef}>
            <DialTicks radius={480} isInner={false} />
          </div>
          <div className="dial dial-inner" id="dial-inner" ref={dialInnerRef}>
            <DialTicks radius={360} isInner={true} />
          </div>
        </div>
      </div>

      {/* Date info panel */}
      <div className="date-container">
        <div className="date-text" id="date-val">{dateText}</div>
        <div className="day-text" id="day-val">{dayText}</div>
      </div>

      {/* Collapsible Status & Navigation Capsule */}
      <div className={`bottom-panel ${panelOpen ? "open" : ""}`}>
        <button
          className="panel-toggle-btn"
          onClick={() => setPanelOpen(!panelOpen)}
          title={panelOpen ? "Collapse Navigation" : "Expand Navigation"}
        >
          <i className={`fa-solid ${panelOpen ? "fa-chevron-down" : "fa-chevron-up"}`}></i>
        </button>

        <div className="panel-contents">
          <div className="status-group">
            <i
              className={batteryIconClass}
              id="battery-icon"
              style={{ color: batteryIconColor }}
            ></i>
            <span className="status-text" id="battery-level">{batteryLevel}</span>
          </div>

          <div className="divider-dot"></div>

          <div className="interactive-icons">

            <button
              className={`icon-btn ${soundEnabled ? "active-sound" : ""}`}
              onClick={toggleSound}
              title="Toggle Tick Sound"
            >
              <i
                className={soundEnabled ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark"}
                id="sound-icon"
              ></i>
            </button>
            <button
              className="icon-btn"
              onClick={handleSettingsToggle}
              title="Settings"
            >
              <i className="fa-solid fa-sliders"></i>
            </button>
          </div>

          <div className="divider-dot"></div>

          <div className="status-group">
            <i className={weatherIconClass} id="weather-icon"></i>
            <span className="status-text" id="weather-val">{weatherTemp}</span>
          </div>
        </div>
      </div>

      {/* Settings Customizer drawer modal */}
      <div
        className={`settings-overlay ${settingsOpen ? "open" : ""}`}
        onClick={handleSettingsToggle}
      ></div>
      
      <div className={`settings-drawer ${settingsOpen ? "open" : ""}`}>
        <div className="drawer-handle"></div>
        <div className="drawer-header">
          <h3>Customization</h3>
          <button className="close-btn" onClick={handleSettingsToggle}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div className="drawer-content">
          {/* Accent Selector */}
          <div className="setting-item">
            <label>Color Accent</label>
            <div className="accent-selector">
              {[
                { hex: "#ff3e3e", name: "Nothing Red" },
                { hex: "#ffffff", name: "Monochrome" },
                { hex: "#00f3ff", name: "Cyber Cyan" },
                { hex: "#39ff14", name: "Neon Green" },
                { hex: "#ffb700", name: "Amber Gold" },
                { hex: "#bf5af2", name: "Purple" }
              ].map((color) => (
                <button
                  key={color.hex}
                  className={`accent-dot ${accentColor === color.hex ? "active" : ""}`}
                  style={{ background: color.hex, color: color.hex }}
                  onClick={() => setAccentColor(color.hex)}
                  title={color.name}
                ></button>
              ))}
            </div>
          </div>

          {/* 12 / 24h Toggle */}
          <div className="setting-item setting-row">
            <label>24-Hour Format</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="fmt-toggle"
                checked={use24h}
                onChange={(e) => setUse24h(e.target.checked)}
              />
              <label htmlFor="fmt-toggle" className="switch-slider"></label>
            </div>
          </div>

          {/* Ambient Orbs Toggle */}
          <div className="setting-item setting-row">
            <label>Ambient Glow Orbs</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="orb-toggle"
                checked={orbsEnabled}
                onChange={(e) => setOrbsEnabled(e.target.checked)}
              />
              <label htmlFor="orb-toggle" className="switch-slider"></label>
            </div>
          </div>

          {/* Sound Setting Toggle */}
          <div className="setting-item setting-row">
            <label>Tick Sound</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="sound-setting-toggle"
                checked={soundEnabled}
                onChange={(e) => {
                  ensureAudio();
                  setSoundEnabled(e.target.checked);
                }}
              />
              <label htmlFor="sound-setting-toggle" className="switch-slider"></label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
