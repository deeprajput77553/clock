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
  const [matrixEnabled, setMatrixEnabled] = useState(true);

  // ── Collapsible Bottom Panel State ──
  const [panelOpen, setPanelOpen] = useState(false);

  // ── Battery Widget State ──
  const [batteryPercent, setBatteryPercent] = useState(100);
  const [batteryIsCharging, setBatteryIsCharging] = useState(false);
  const [batteryIconColor, setBatteryIconColor] = useState("");

  // ── Weather Widget State ──
  const [weatherData, setWeatherData] = useState({
    temp: "—°C",
    status: "LOADING...",
    iconClass: "fa-solid fa-cloud-sun weather-icon-card",
    high: "—",
    low: "—",
    wind: "—"
  });

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
      setBatteryPercent(lvl);
      setBatteryIsCharging(battery.charging);
      
      let color = "";
      if (battery.charging) {
        color = "var(--accent)";
      } else if (lvl <= 20) {
        color = "#ffb700";
      }
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
      setBatteryPercent(100);
    }

    return () => {
      if (batteryInstance) {
        if (onLevelChange) batteryInstance.removeEventListener("levelchange", onLevelChange);
        if (onChargingChange) batteryInstance.removeEventListener("chargingchange", onChargingChange);
      }
    };
  }, []);

  // ── 5. Detailed Geolocation Weather Fetcher ──
  useEffect(() => {
    const fetchWeather = (lat, lon) => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`)
        .then((r) => r.json())
        .then((data) => {
          const temp = Math.round(data.current_weather.temperature);
          const code = data.current_weather.weathercode;
          const maxTemp = Math.round(data.daily.temperature_2m_max[0]);
          const minTemp = Math.round(data.daily.temperature_2m_min[0]);
          const wind = Math.round(data.current_weather.windspeed);

          // Code mapping
          let statusText = "CLEAR";
          let icon = "fa-solid fa-sun weather-icon-card";

          if (code === 0) {
            statusText = "CLEAR";
            icon = "fa-solid fa-sun weather-icon-card";
          } else if (code <= 3) {
            statusText = "CLOUDY";
            icon = "fa-solid fa-cloud-sun weather-icon-card";
          } else if (code <= 48) {
            statusText = "FOGGY";
            icon = "fa-solid fa-smog weather-icon-card";
          } else if (code <= 67) {
            statusText = "RAINY";
            icon = "fa-solid fa-cloud-rain weather-icon-card";
          } else if (code <= 77) {
            statusText = "SNOWY";
            icon = "fa-solid fa-snowflake weather-icon-card";
          } else {
            statusText = "STORM";
            icon = "fa-solid fa-bolt weather-icon-card";
          }

          setWeatherData({
            temp: temp + "°C",
            status: statusText,
            iconClass: icon,
            high: maxTemp + "°",
            low: minTemp + "°",
            wind: wind + " km/h"
          });
        })
        .catch(() => {
          setWeatherData(prev => ({ ...prev, status: "ERROR", temp: "—°C" }));
        });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => setWeatherData(prev => ({ ...prev, status: "NO GPS", temp: "—°C" }))
      );
    } else {
      setWeatherData(prev => ({ ...prev, status: "UNSUPPORTED" }));
    }
  }, []);

  // ── 6. Month Calendar Day Matrix Helper ──
  const getCalendarDays = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0-6 (Sun-Sat)
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNum: "", isEmpty: true });
    }
    const today = now.getDate();
    for (let i = 1; i <= totalDays; i++) {
      days.push({ dayNum: i, isEmpty: false, isToday: i === today });
    }
    return days;
  };

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

  const batteryCircumference = 2 * Math.PI * 32;
  const batteryOffset = batteryCircumference * (1 - batteryPercent / 100);

  return (
    <div className="clock-screen" style={containerStyle}>
      {/* Dynamic Screen Matrix LCD Pixel overlay filter */}
      <div className={`matrix-overlay ${!matrixEnabled ? "matrix-hidden" : ""}`}></div>

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

      {/* Widgets Dashboard Grid Sidebar */}
      <div className="widgets-container">
        {/* Widget 1: Calendar */}
        <div className="widget-card widget-span-2">
          <div className="widget-header">
            <span>Calendar</span>
            <i className="fa-regular fa-calendar-days"></i>
          </div>
          <div className="widget-body calendar-widget-body">
            <div className="calendar-date-row">
              <div className="calendar-day-matrix">{dayText}</div>
              <div className="calendar-full-date">{dateText}</div>
            </div>
            <div className="calendar-grid">
              {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((d) => (
                <div key={d} className="calendar-day-label">{d}</div>
              ))}
              {getCalendarDays().map((d, index) => (
                <div
                  key={index}
                  className={`calendar-day ${d.isEmpty ? "empty" : ""} ${d.isToday ? "active" : ""}`}
                >
                  {d.dayNum}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Widget 2: Weather */}
        <div className="widget-card">
          <div className="widget-header">
            <span>Weather</span>
            <i className="fa-solid fa-cloud-sun"></i>
          </div>
          <div className="widget-body">
            <div className="weather-widget-body">
              <i className={weatherData.iconClass}></i>
              <div className="weather-temp-large">{weatherData.temp}</div>
            </div>
            <div className="weather-status-text">{weatherData.status}</div>
            <div className="weather-specs">
              <div className="weather-spec-item">
                <span className="weather-spec-label">H/L</span>
                <span>{weatherData.high} / {weatherData.low}</span>
              </div>
              <div className="weather-spec-item">
                <span className="weather-spec-label">Wind</span>
                <span>{weatherData.wind}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Widget 3: Battery */}
        <div className="widget-card">
          <div className="widget-header">
            <span>Battery</span>
            <i className="fa-solid fa-battery-three-quarters"></i>
          </div>
          <div className="widget-body">
            <div className="battery-widget-container">
              <svg width="76" height="76" viewBox="0 0 76 76" className="battery-svg-ring">
                <circle className="battery-ring-bg" cx="38" cy="38" r="32" strokeWidth="4.5" />
                <circle
                  className="battery-ring-fg"
                  cx="38" cy="38" r="32"
                  strokeWidth="4.5"
                  strokeDasharray={batteryCircumference}
                  strokeDashoffset={batteryOffset}
                />
              </svg>
              <div className="battery-text-center">
                <span>{batteryPercent}%</span>
                {batteryIsCharging && (
                  <i className="fa-solid fa-bolt battery-charge-icon"></i>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Widget 4: Quick Controls */}
        <div className="widget-card widget-span-2">
          <div className="widget-header">
            <span>Quick Settings</span>
            <i className="fa-solid fa-sliders"></i>
          </div>
          <div className="widget-body">
            <div className="quick-toggles-grid">
              {/* 24h toggle */}
              <div className="quick-toggle-container">
                <button
                  className={`quick-toggle-btn ${use24h ? "active" : ""}`}
                  onClick={() => setUse24h(!use24h)}
                  title="Toggle 24-Hour Format"
                >
                  <i className="fa-regular fa-clock"></i>
                </button>
                <span className="quick-toggle-label">{use24h ? "24H" : "12H"}</span>
              </div>

              {/* Tick sound toggle */}
              <div className="quick-toggle-container">
                <button
                  className={`quick-toggle-btn ${soundEnabled ? "active-accent" : ""}`}
                  onClick={toggleSound}
                  title="Toggle Tick Audio"
                >
                  <i className={soundEnabled ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark"}></i>
                </button>
                <span className="quick-toggle-label">Tick</span>
              </div>

              {/* Ambient Glow Orbs toggle */}
              <div className="quick-toggle-container">
                <button
                  className={`quick-toggle-btn ${orbsEnabled ? "active" : ""}`}
                  onClick={() => setOrbsEnabled(!orbsEnabled)}
                  title="Toggle Glow Orbs"
                >
                  <i className="fa-solid fa-circle-half-stroke"></i>
                </button>
                <span className="quick-toggle-label">Glow</span>
              </div>

              {/* Screen Matrix overlay toggle */}
              <div className="quick-toggle-container">
                <button
                  className={`quick-toggle-btn ${matrixEnabled ? "active" : ""}`}
                  onClick={() => setMatrixEnabled(!matrixEnabled)}
                  title="Toggle LCD Matrix Filter"
                >
                  <i className="fa-solid fa-border-all"></i>
                </button>
                <span className="quick-toggle-label">Matrix</span>
              </div>
            </div>
          </div>
        </div>
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
          {/* Detailed Battery indicator */}
          <div className="status-group">
            <i
              className={batteryIsCharging ? "fa-solid fa-battery-bolt status-icon" : "fa-solid fa-battery-three-quarters status-icon"}
              id="battery-icon"
              style={{ color: batteryIconColor }}
            ></i>
            <span className="status-text" id="battery-level">{batteryPercent}%</span>
          </div>

          <div className="divider-dot"></div>

          <div className="interactive-icons">
            <button
              className={`icon-btn ${soundEnabled ? "active-sound" : ""}`}
              onClick={toggleSound}
              title="Toggle Tick Sound"
            >
              <i className={soundEnabled ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark"}></i>
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

          {/* Detailed Weather spec */}
          <div className="status-group">
            <i className={weatherData.iconClass} id="weather-icon"></i>
            <span className="status-text" id="weather-val">{weatherData.temp}</span>
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

          {/* Matrix Screen filter Toggle */}
          <div className="setting-item setting-row">
            <label>LCD Pixel Matrix Filter</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="matrix-setting-toggle"
                checked={matrixEnabled}
                onChange={(e) => setMatrixEnabled(e.target.checked)}
              />
              <label htmlFor="matrix-setting-toggle" className="switch-slider"></label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
