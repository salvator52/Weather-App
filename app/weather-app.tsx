"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Compass, Droplets, Eye, Gauge, Heart, LocateFixed, MapPin, Moon, Navigation, Search, Sparkles, Sun, Sunrise, Sunset, Umbrella, Wind, X } from "lucide-react";

type Place = { name: string; country: string; latitude: number; longitude: number; admin1?: string };
type WeatherData = {
  current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; precipitation: number; weather_code: number; wind_speed_10m: number; wind_direction_10m: number; pressure_msl: number; visibility: number; is_day: number };
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; weather_code: number[] };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; wind_speed_10m_max: number[]; sunrise: string[]; sunset: string[]; uv_index_max: number[] };
};

const ISTANBUL: Place = { name: "İstanbul", country: "Türkiye", latitude: 41.0082, longitude: 28.9784 };
const weatherLabel = (c: number) => c === 0 ? "Açık" : c <= 3 ? "Parçalı bulutlu" : c <= 48 ? "Sisli" : c <= 57 ? "Çisenti" : c <= 67 ? "Yağmurlu" : c <= 77 ? "Karlı" : c <= 82 ? "Sağanak yağışlı" : c <= 86 ? "Kar sağanaklı" : "Gök gürültülü";
const weatherIcon = (c: number, day = true) => c === 0 ? (day ? "☀" : "☾") : c <= 3 ? "☁" : c <= 48 ? "≋" : c <= 67 || (c >= 80 && c <= 82) ? "☂" : c <= 86 ? "❄" : "ϟ";
const sceneFor = (code: number, isDay: number) => !isDay ? "night" : code === 0 ? "clear" : code <= 3 ? "cloudy" : code <= 48 ? "fog" : code <= 67 || (code >= 80 && code <= 82) ? "rain" : code <= 86 ? "snow" : "storm";
const fmtTime = (s: string) => new Date(s).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (s: string, i: number) => i === 0 ? "Bugün" : new Date(s).toLocaleDateString("tr-TR", { weekday: "long" });

function RainCanvas({ active, storm, windSpeed, windDirection }: { active: boolean; storm: boolean; windSpeed: number; windDirection: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let width = 0, height = 0, frame = 0, previous = performance.now();
    type Drop = { x: number; y: number; depth: number; speed: number; length: number; opacity: number };
    let drops: Drop[] = [];
    const makeDrop = (randomY = false): Drop => {
      const depth = .2 + Math.random() * .8;
      return { x: Math.random() * width, y: randomY ? Math.random() * height : -Math.random() * height * .25, depth, speed: 470 + depth * (storm ? 760 : 610), length: 5 + depth * (storm ? 28 : 21), opacity: .05 + depth * (storm ? .3 : .22) };
    };
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round(Math.min(220, Math.max(85, width / (storm ? 6.5 : 9))));
      drops = Array.from({ length: count }, () => makeDrop(true));
    };
    const horizontalSpeed = Math.sin(windDirection * Math.PI / 180) * Math.min(34, windSpeed * 1.45);
    const draw = (now: number) => {
      const delta = Math.min(.032, (now - previous) / 1000); previous = now;
      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      for (const drop of drops) {
        const vx = horizontalSpeed * (.45 + drop.depth * .55);
        drop.x += vx * delta; drop.y += drop.speed * delta;
        if (drop.y > height + drop.length || drop.x < -40 || drop.x > width + 40) Object.assign(drop, makeDrop(false));
        const gradient = context.createLinearGradient(drop.x, drop.y - drop.length, drop.x, drop.y);
        gradient.addColorStop(0, "rgba(194,226,240,0)");
        gradient.addColorStop(1, `rgba(224,242,250,${drop.opacity})`);
        context.strokeStyle = gradient; context.lineWidth = .45 + drop.depth * 1.05;
        context.beginPath(); context.moveTo(drop.x - vx * .035, drop.y - drop.length); context.lineTo(drop.x, drop.y); context.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    resize(); window.addEventListener("resize", resize); frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); context.clearRect(0, 0, width, height); };
  }, [active, storm, windSpeed, windDirection]);
  return <canvas ref={canvasRef} className="rain-canvas" aria-hidden="true" />;
}

function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card || window.matchMedia("(pointer: coarse)").matches) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };
  return <div ref={cardRef} onMouseMove={handleMove} className={`spotlight-card ${className}`}>{children}</div>;
}

const WeatherGlyph = ({ code, isDay = true, size = 24 }: { code: number; isDay?: boolean; size?: number }) => {
  if (code === 0) return isDay ? <Sun size={size}/> : <Moon size={size}/>;
  if (code <= 3) return <Cloud size={size}/>;
  if (code <= 48) return <CloudFog size={size}/>;
  if (code <= 67 || (code >= 80 && code <= 82)) return <CloudRain size={size}/>;
  if (code <= 86) return <CloudSnow size={size}/>;
  return <CloudLightning size={size}/>;
};

export default function WeatherApp() {
  const [place, setPlace] = useState<Place>(ISTANBUL);
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const [selectedHour, setSelectedHour] = useState(0);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("auto");
  const [favorites, setFavorites] = useState<Place[]>([]);
  const [displayTemp, setDisplayTemp] = useState(0);
  const [sceneChanging, setSceneChanging] = useState(false);
  const reduceMotion = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const last = localStorage.getItem("atmos-last-place");
      const fav = localStorage.getItem("atmos-favorites");
      const savedTheme = localStorage.getItem("atmos-theme") as typeof theme;
      if (last) setPlace(JSON.parse(last));
      if (fav) setFavorites(JSON.parse(fav));
      if (savedTheme) setTheme(savedTheme);
    } catch { /* local data is optional */ }
  }, []);

  const loadWeather = useCallback(async (p: Place) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ latitude: String(p.latitude), longitude: String(p.longitude), timezone: "auto", forecast_days: "7", current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility,is_day", hourly: "temperature_2m,precipitation_probability,weather_code", daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max" });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error();
      setData(await response.json());
      localStorage.setItem("atmos-last-place", JSON.stringify(p));
    } catch { setError("Hava verileri şu anda alınamıyor. Lütfen tekrar dene."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadWeather(place); }, [place, loadWeather]);

  const search = (value: string) => {
    setQuery(value); setSearchOpen(true); setActiveResult(0); setSearchMessage("");
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=6&language=tr&format=json`);
        const json = await res.json(); const found = json.results || []; setResults(found); if (!found.length) setSearchMessage("Bu isimde bir şehir bulamadık.");
      } catch { setResults([]); setSearchMessage("Şehir araması şu anda kullanılamıyor."); }
      finally { setSearching(false); }
    }, 280);
  };
  const choosePlace = (p: Place) => { setPlace(p); setQuery(""); setSearchOpen(false); setSelectedHour(0); };
  const useLocation = () => navigator.geolocation?.getCurrentPosition(async ({ coords }) => {
    choosePlace({ name: "Konumum", country: "", latitude: coords.latitude, longitude: coords.longitude });
  }, () => setError("Konum izni verilmedi; İstanbul gösteriliyor."));
  const toggleFavorite = () => {
    const exists = favorites.some(f => f.latitude === place.latitude && f.longitude === place.longitude);
    const next = exists ? favorites.filter(f => f.latitude !== place.latitude || f.longitude !== place.longitude) : [...favorites, place];
    setFavorites(next); localStorage.setItem("atmos-favorites", JSON.stringify(next));
  };
  const cycleTheme = () => { const next = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto"; setTheme(next); localStorage.setItem("atmos-theme", next); };

  const hourStart = useMemo(() => data ? Math.max(0, data.hourly.time.findIndex(t => new Date(t) >= new Date())) : 0, [data]);
  const hourIndices = useMemo(() => Array.from({ length: 12 }, (_, i) => hourStart + i), [hourStart]);
  const selectedIndex = hourIndices[selectedHour] ?? hourStart;
  const shownTemp = data ? (selectedHour ? data.hourly.temperature_2m[selectedIndex] : data.current.temperature_2m) : 0;
  const shownCode = data ? (selectedHour ? data.hourly.weather_code[selectedIndex] : data.current.weather_code) : 0;
  const shownTime = data ? new Date(selectedHour ? data.hourly.time[selectedIndex] : Date.now()) : new Date();
  const sunrise = data ? new Date(data.daily.sunrise[0]) : new Date();
  const sunset = data ? new Date(data.daily.sunset[0]) : new Date();
  const shownIsDay = data ? (shownTime >= sunrise && shownTime <= sunset ? 1 : 0) : 1;
  const twilight = data && shownIsDay && (Math.abs(shownTime.getTime() - sunrise.getTime()) < 75 * 60_000 || Math.abs(shownTime.getTime() - sunset.getTime()) < 75 * 60_000);
  const scene = data ? sceneFor(shownCode, shownIsDay) : "clear";
  const advice = data ? (data.current.precipitation > 0 || data.daily.precipitation_probability_max[0] > 55 ? "Şemsiyeni almayı unutma" : data.daily.uv_index_max[0] >= 6 ? "UV seviyesi yüksek · Güneş kremini unutma" : data.current.wind_speed_10m < 20 && data.current.temperature_2m > 12 ? "Dışarı çıkmak için harika bir hava" : "Akşam serinleyebilir · Yanına bir kat daha al") : "";
  const isFav = favorites.some(f => f.latitude === place.latitude && f.longitude === place.longitude);

  useEffect(() => {
    const target = Math.round(shownTemp);
    const start = displayTemp;
    if (start === target) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 520);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayTemp(Math.round(start + (target - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  // displayTemp is intentionally captured as the animation's starting value.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownTemp]);

  const selectHour = (index: number) => {
    if (index === selectedHour) return;
    setSceneChanging(true);
    window.setTimeout(() => {
      setSelectedHour(index);
      window.setTimeout(() => setSceneChanging(false), 80);
    }, 180);
  };
  const handleParallax = (event: React.MouseEvent<HTMLElement>) => {
    if (!shellRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const x = (event.clientX / window.innerWidth - .5) * 2;
    const y = (event.clientY / window.innerHeight - .5) * 2;
    shellRef.current.style.setProperty("--pointer-x", x.toFixed(3));
    shellRef.current.style.setProperty("--pointer-y", y.toFixed(3));
  };
  const tilt = (event: React.MouseEvent<HTMLElement>) => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--tilt-x", `${((event.clientY - box.top) / box.height - .5) * -3}deg`);
    card.style.setProperty("--tilt-y", `${((event.clientX - box.left) / box.width - .5) * 3}deg`);
    card.style.setProperty("--shine-x", `${((event.clientX - box.left) / box.width) * 100}%`);
  };
  const resetTilt = (event: React.MouseEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  };

  const atmosphereStyle = { "--wind-duration": `${Math.max(10, 38 - (data?.current.wind_speed_10m || 8) * .65)}s` } as React.CSSProperties;

  return <main ref={shellRef} onMouseMove={handleParallax} className={`weather-shell scene-${scene} theme-${theme} ${twilight ? "is-twilight" : ""} ${sceneChanging ? "scene-changing" : ""}`}>
    <AnimatePresence mode="popLayout"><motion.div key={scene} className={`theme-backdrop backdrop-${scene}`} initial={{opacity:0,scale:1.04}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.98}} transition={{duration:reduceMotion?0:.9,ease:[.22,1,.36,1]}}/></AnimatePresence>
    <div className="atmosphere" style={atmosphereStyle} aria-hidden="true">
      <div className="stars">{Array.from({length:24},(_,i)=><i key={i} style={{"--i":i,left:`${(i * 47 + i * i * 7) % 98}%`,top:`${4 + (i * 29 + i * i * 3) % 60}%`,width:`${1 + i % 3}px`,height:`${1 + i % 3}px`,animationDuration:`${2.2 + (i % 5) * .5}s`,animationDelay:`-${i * .19}s`} as React.CSSProperties}/>)}</div>
      <div className="sun"><div className="sun-rays"/></div><div className="moon"/>
      <div className="cloud cloud-a"/><div className="cloud cloud-b"/><div className="cloud cloud-c"/>
      <div className="fog-bank fog-a"/><div className="fog-bank fog-b"/>
      <div className="horizon horizon-a"/><div className="horizon horizon-b"/>
      <div className="precip">{Array.from({length:72},(_,i)=>{
        const depth = .55 + (i % 5) * .18;
        const windPush = Math.sin(((data?.current.wind_direction_10m || 0) * Math.PI) / 180) * (data?.current.wind_speed_10m || 8) * 3;
        return <i key={i} style={{"--i":i,"--size":`${.65+depth}px`,"--length":`${18+depth*24}px`,"--opacity":.16+depth*.28,"--fall-duration":`${1.28-depth*.47+(i%4)*.07}s`,"--drift":`${windPush*depth+(i%3)*8}px`,left:`${((i*37)+(i*i*13)+11)%101}%`,animationDelay:`-${((i*31)%100)/47}s`,filter:`blur(${depth<.75?.55:0}px)`} as React.CSSProperties}/>;
      })}</div>
      <div className="lightning"><i/><i/><i/></div><div className="scene-glow"/>
    </div>
    <RainCanvas active={scene === "rain" || scene === "storm"} storm={scene === "storm"} windSpeed={data?.current.wind_speed_10m || 0} windDirection={data?.current.wind_direction_10m || 0}/>
    <motion.header className="topbar" initial={{y:-20,opacity:0}} animate={{y:0,opacity:1}} transition={{duration:.55}}>
      <button className="brand" onClick={() => choosePlace(ISTANBUL)}><span className="brand-mark"><Cloud size={19}/></span><span>ATMOS</span><small>WEATHER</small></button>
      <div className="header-actions">
        <div className="search-wrap">
          <span className="search-icon"><Search size={17}/></span>
          <input value={query} onChange={e=>search(e.target.value)} onFocus={()=>setSearchOpen(true)} onKeyDown={e=>{if(e.key==="ArrowDown")setActiveResult(v=>Math.min(results.length-1,v+1));if(e.key==="ArrowUp")setActiveResult(v=>Math.max(0,v-1));if(e.key==="Enter"&&results[activeResult])choosePlace(results[activeResult]);if(e.key==="Escape")setSearchOpen(false)}} placeholder="Şehir ara..." aria-label="Şehir ara" />
          {searching && <span className="search-loader"/>}
          <AnimatePresence>{searchOpen && (query.length>1 || favorites.length>0) && <motion.div className="search-panel" initial={{opacity:0,y:-8,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-6,scale:.98}}>
            {results.map((r,i)=><button key={`${r.latitude}-${r.longitude}`} className={i===activeResult?"active":""} onClick={()=>choosePlace(r)}><MapPin size={16}/><span><b>{r.name}</b><small>{r.admin1 ? `${r.admin1}, ` : ""}{r.country}</small></span></button>)}
            {searchMessage && <p className="search-message"><CloudFog size={18}/>{searchMessage}</p>}
            {!query && favorites.map(f=><button key={f.name} onClick={()=>choosePlace(f)}><Heart size={15}/><span><b>{f.name}</b><small>Favori şehir</small></span></button>)}
          </motion.div>}</AnimatePresence>
        </div>
        <button className="locate-btn" onClick={useLocation} aria-label="Konumumu kullan"><LocateFixed size={17}/><span>Konumum</span></button>
        <button className="theme-btn" onClick={cycleTheme} aria-label="Temayı değiştir">{theme === "dark" ? <Moon size={16}/> : <Sun size={16}/>}<small>{theme === "auto" ? "Otomatik" : theme === "light" ? "Aydınlık" : "Karanlık"}</small></button>
      </div>
    </motion.header>

    {loading && <div className="state-card"><div className="spinner"/><p>Gökyüzü okunuyor…</p></div>}
    {error && !loading && <div className="state-card"><p>{error}</p><button onClick={()=>loadWeather(place)}>Tekrar dene</button></div>}
    {data && !loading && <div key={`${place.latitude}-${place.longitude}`} className="content content-ready">
      <AnimatePresence mode="wait"><motion.section key={`${place.name}-${shownCode}`} className="hero hero-glass" initial={{opacity:0,y:28,filter:"blur(12px)"}} animate={{opacity:1,y:0,filter:"blur(0px)"}} exit={{opacity:0,y:-18,filter:"blur(10px)"}} transition={{duration:reduceMotion?0:.6,ease:[.22,1,.36,1]}}>
        <div className="hero-topline"><div className="location-row"><MapPin size={15}/><span className="eyebrow">{place.name}{place.country ? `, ${place.country}` : ""}</span></div><button onClick={toggleFavorite} className={`favorite ${isFav?"on":""}`} aria-label="Favorilere ekle"><Heart size={19} fill={isFav?"currentColor":"none"}/></button></div>
        <motion.div className="temperature" aria-live="polite" initial={{scale:.72,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:"spring",stiffness:120,damping:16}}><span>{displayTemp}</span><sup>°</sup></motion.div>
        <div className="condition-line"><WeatherGlyph code={shownCode} isDay={shownIsDay===1} size={28}/><p className="condition">{weatherLabel(shownCode)}</p></div>
        <p className="feels">Hissedilen {Math.round(data.current.apparent_temperature)}° <i/> En yüksek {Math.round(data.daily.temperature_2m_max[0])}°</p>
        <div className="advice"><Sparkles size={16}/><p>{advice}</p></div>
      </motion.section></AnimatePresence>

      <section className="metrics" aria-label="Hava durumu detayları">
        {[
          {label:"Nem",value:`%${data.current.relative_humidity_2m}`,icon:<Droplets/>},
          {label:"Rüzgâr",value:`${Math.round(data.current.wind_speed_10m)} km/s`,icon:<Wind/>},
          {label:"Basınç",value:`${Math.round(data.current.pressure_msl)} hPa`,icon:<Gauge/>},
          {label:"Görüş",value:`${Math.round((data.current.visibility||0)/1000)} km`,icon:<Eye/>},
          {label:"Gün doğumu",value:fmtTime(data.daily.sunrise[0]),icon:<Sunrise/>},
          {label:"Gün batımı",value:fmtTime(data.daily.sunset[0]),icon:<Sunset/>}
        ].map((metric,i)=><motion.div key={metric.label} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:.08*i,duration:.45}}><SpotlightCard className="metric-card"><span className="metric-icon">{metric.icon}</span><div><small>{metric.label}</small><b>{metric.value}</b></div></SpotlightCard></motion.div>)}
      </section>

      <section className="forecast-block tilt-card" onMouseMove={tilt} onMouseLeave={resetTilt}>
        <div className="section-title"><div><h2>Saatlik Tahmin</h2><p>Bugün · {new Date().toLocaleDateString("tr-TR",{day:"numeric",month:"long"})}</p></div><span>Kaydır →</span></div>
        <div className="hourly">
          {hourIndices.map((idx,i)=><motion.button key={idx} onClick={()=>selectHour(i)} className={selectedHour===i?"selected":""} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} whileHover={{y:-5}} transition={{delay:i*.035}}><span>{i===0?"Şimdi":fmtTime(data.hourly.time[idx])}</span><b className="weather-symbol"><WeatherGlyph code={data.hourly.weather_code[idx]} isDay={new Date(data.hourly.time[idx]) >= sunrise && new Date(data.hourly.time[idx]) <= sunset}/></b><strong>{Math.round(data.hourly.temperature_2m[idx])}°</strong><small>{data.hourly.precipitation_probability[idx]>20?<><Droplets size={11}/>%{data.hourly.precipitation_probability[idx]}</>:" "}</small></motion.button>)}
        </div>
      </section>

      <section className="bottom-grid">
        <div className="weekly forecast-block tilt-card" onMouseMove={tilt} onMouseLeave={resetTilt}>
          <div className="section-title"><div><h2>7 Günlük Tahmin</h2><p>Haftaya genel bakış</p></div></div>
          <div className="days">{data.daily.time.map((d,i)=><motion.div key={d} className={`day ${expandedDay===i?"expanded":""}`} initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:i*.075,duration:.45}}><SpotlightCard className="day-card"><button onClick={()=>setExpandedDay(expandedDay===i?null:i)}><span className="day-name">{fmtDay(d,i)}</span><span className="daily-icon"><WeatherGlyph code={data.daily.weather_code[i]} size={30}/></span><span className="day-condition">{weatherLabel(data.daily.weather_code[i])}</span><span className="rain-chance"><Droplets size={12}/>%{data.daily.precipitation_probability_max[i]}</span><span className="temp-range"><b>{Math.round(data.daily.temperature_2m_max[i])}°</b><em>{Math.round(data.daily.temperature_2m_min[i])}°</em></span></button><AnimatePresence>{expandedDay===i&&<motion.div className="day-detail" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}><span><Wind size={12}/>{Math.round(data.daily.wind_speed_10m_max[i])} km/s</span><span>UV {Math.round(data.daily.uv_index_max[i])}</span></motion.div>}</AnimatePresence></SpotlightCard></motion.div>)}</div>
        </div>
        <div className="side-stack">
          <article className="sun-card"><div><small>GÜN DOĞUMU</small><b>{fmtTime(data.daily.sunrise[0])}</b></div><div className="sun-arc"><i/><span>☀</span></div><div><small>GÜN BATIMI</small><b>{fmtTime(data.daily.sunset[0])}</b></div></article>
          <article className="mini-card"><div><span className="mini-icon">◌</span><div><small>YAĞIŞ İHTİMALİ</small><b>%{data.daily.precipitation_probability_max[0]}</b></div></div><div className="bar"><i style={{width:`${data.daily.precipitation_probability_max[0]}%`}}/></div><p>{data.daily.precipitation_probability_max[0] < 30 ? "Bugün yağış beklenmiyor" : "Gün içinde yağış görülebilir"}</p></article>
          <article className="mini-card wind"><div><span className="mini-icon">↗</span><div><small>RÜZGÂR YÖNÜ</small><b>{Math.round(data.current.wind_direction_10m)}°</b></div></div><div className="compass"><span style={{transform:`rotate(${data.current.wind_direction_10m}deg)`}}>↑</span><i>K</i><i>D</i><i>G</i><i>B</i></div></article>
        </div>
      </section>
      <footer><span>ATMOS</span><p>Veriler Open‑Meteo tarafından sağlanmaktadır</p><p>Son güncelleme · {new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}</p></footer>
    </div>}
  </main>;
}
