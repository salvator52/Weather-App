"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Place = { name: string; country: string; latitude: number; longitude: number; admin1?: string };
type WeatherData = {
  current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; precipitation: number; weather_code: number; wind_speed_10m: number; wind_direction_10m: number; pressure_msl: number; is_day: number };
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; weather_code: number[] };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; wind_speed_10m_max: number[]; sunrise: string[]; sunset: string[]; uv_index_max: number[] };
};

const ISTANBUL: Place = { name: "İstanbul", country: "Türkiye", latitude: 41.0082, longitude: 28.9784 };
const weatherLabel = (c: number) => c === 0 ? "Açık" : c <= 3 ? "Parçalı bulutlu" : c <= 48 ? "Sisli" : c <= 57 ? "Çisenti" : c <= 67 ? "Yağmurlu" : c <= 77 ? "Karlı" : c <= 82 ? "Sağanak yağışlı" : c <= 86 ? "Kar sağanaklı" : "Gök gürültülü";
const weatherIcon = (c: number, day = true) => c === 0 ? (day ? "☀" : "☾") : c <= 3 ? "☁" : c <= 48 ? "≋" : c <= 67 || (c >= 80 && c <= 82) ? "☂" : c <= 86 ? "❄" : "ϟ";
const sceneFor = (code: number, isDay: number) => !isDay ? "night" : code === 0 ? "clear" : code <= 3 ? "cloudy" : code <= 48 ? "fog" : code <= 67 || (code >= 80 && code <= 82) ? "rain" : code <= 86 ? "snow" : "storm";
const fmtTime = (s: string) => new Date(s).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (s: string, i: number) => i === 0 ? "Bugün" : new Date(s).toLocaleDateString("tr-TR", { weekday: "long" });

export default function WeatherApp() {
  const [place, setPlace] = useState<Place>(ISTANBUL);
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const [selectedHour, setSelectedHour] = useState(0);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("auto");
  const [favorites, setFavorites] = useState<Place[]>([]);
  const [displayTemp, setDisplayTemp] = useState(0);
  const [sceneChanging, setSceneChanging] = useState(false);
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
      const params = new URLSearchParams({ latitude: String(p.latitude), longitude: String(p.longitude), timezone: "auto", forecast_days: "7", current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,is_day", hourly: "temperature_2m,precipitation_probability,weather_code", daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max" });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error();
      setData(await response.json());
      localStorage.setItem("atmos-last-place", JSON.stringify(p));
    } catch { setError("Hava verileri şu anda alınamıyor. Lütfen tekrar dene."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadWeather(place); }, [place, loadWeather]);

  const search = (value: string) => {
    setQuery(value); setSearchOpen(true); setActiveResult(0);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=6&language=tr&format=json`);
        const json = await res.json(); setResults(json.results || []);
      } catch { setResults([]); }
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
    <header className="topbar">
      <button className="brand" onClick={() => choosePlace(ISTANBUL)}><span className="brand-mark">◒</span><span>ATMOS</span></button>
      <div className="header-actions">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input value={query} onChange={e=>search(e.target.value)} onFocus={()=>setSearchOpen(true)} onKeyDown={e=>{if(e.key==="ArrowDown")setActiveResult(v=>Math.min(results.length-1,v+1));if(e.key==="ArrowUp")setActiveResult(v=>Math.max(0,v-1));if(e.key==="Enter"&&results[activeResult])choosePlace(results[activeResult]);if(e.key==="Escape")setSearchOpen(false)}} placeholder="Şehir ara..." aria-label="Şehir ara" />
          {searchOpen && (query.length>1 || favorites.length>0) && <div className="search-panel">
            {results.map((r,i)=><button key={`${r.latitude}-${r.longitude}`} className={i===activeResult?"active":""} onClick={()=>choosePlace(r)}><span>⌖</span><span><b>{r.name}</b><small>{r.admin1 ? `${r.admin1}, ` : ""}{r.country}</small></span></button>)}
            {!results.length && query.length>1 && <p>Şehir aranıyor…</p>}
            {!query && favorites.map(f=><button key={f.name} onClick={()=>choosePlace(f)}><span>★</span><span><b>{f.name}</b><small>Favori şehir</small></span></button>)}
          </div>}
        </div>
        <button className="icon-btn locate" onClick={useLocation} aria-label="Konumumu kullan">⌖</button>
        <button className="theme-btn" onClick={cycleTheme} aria-label="Temayı değiştir"><span>◐</span><small>{theme === "auto" ? "Otomatik" : theme === "light" ? "Aydınlık" : "Karanlık"}</small></button>
      </div>
    </header>

    {loading && <div className="state-card"><div className="spinner"/><p>Gökyüzü okunuyor…</p></div>}
    {error && !loading && <div className="state-card"><p>{error}</p><button onClick={()=>loadWeather(place)}>Tekrar dene</button></div>}
    {data && !loading && <div key={`${place.latitude}-${place.longitude}`} className="content content-ready">
      <section className="hero">
        <div className="location-row"><span className="eyebrow">⌖ {place.name}{place.country ? `, ${place.country}` : ""}</span><button onClick={toggleFavorite} className={`favorite ${isFav?"on":""}`} aria-label="Favorilere ekle">{isFav?"★":"☆"}</button></div>
        <div className="temperature" aria-live="polite"><span>{displayTemp}</span><sup>°</sup></div>
        <p className="condition">{weatherLabel(shownCode)}</p>
        <p className="feels">Hissedilen {Math.round(data.current.apparent_temperature)}° <i/> En yüksek {Math.round(data.daily.temperature_2m_max[0])}°</p>
        <div className="advice"><span>✦</span><p>{advice}</p><button aria-label="Öneriyi kapat">×</button></div>
      </section>

      <section className="metrics" aria-label="Hava durumu detayları">
        {[["◫","NEM",`%${data.current.relative_humidity_2m}`],["↗","RÜZGÂR",`${Math.round(data.current.wind_speed_10m)} km/s`],["◉","BASINÇ",`${Math.round(data.current.pressure_msl)} hPa`],["☀","UV İNDEKSİ",String(Math.round(data.daily.uv_index_max[0]))]].map((m,i)=><article key={m[1]} style={{"--delay":`${i*70}ms`} as React.CSSProperties}><span className="metric-icon">{m[0]}</span><div><small>{m[1]}</small><b>{m[2]}</b></div></article>)}
      </section>

      <section className="forecast-block tilt-card" onMouseMove={tilt} onMouseLeave={resetTilt}>
        <div className="section-title"><div><h2>Saatlik Tahmin</h2><p>Bugün · {new Date().toLocaleDateString("tr-TR",{day:"numeric",month:"long"})}</p></div><span>Kaydır →</span></div>
        <div className="hourly">
          {hourIndices.map((idx,i)=><button key={idx} onClick={()=>selectHour(i)} className={selectedHour===i?"selected":""}><span>{i===0?"Şimdi":fmtTime(data.hourly.time[idx])}</span><b className="weather-symbol">{weatherIcon(data.hourly.weather_code[idx], new Date(data.hourly.time[idx]) >= sunrise && new Date(data.hourly.time[idx]) <= sunset)}</b><strong>{Math.round(data.hourly.temperature_2m[idx])}°</strong><small>{data.hourly.precipitation_probability[idx]>20?`♧ %${data.hourly.precipitation_probability[idx]}`:" "}</small></button>)}
        </div>
      </section>

      <section className="bottom-grid">
        <div className="weekly forecast-block tilt-card" onMouseMove={tilt} onMouseLeave={resetTilt}>
          <div className="section-title"><div><h2>7 Günlük Tahmin</h2><p>Haftaya genel bakış</p></div></div>
          <div className="days">{data.daily.time.map((d,i)=><div key={d} className={`day ${expandedDay===i?"expanded":""}`}><button onClick={()=>setExpandedDay(expandedDay===i?null:i)}><span className="day-name">{fmtDay(d,i)}</span><span className="day-condition"><i>{weatherIcon(data.daily.weather_code[i])}</i>{weatherLabel(data.daily.weather_code[i])}</span><span className="rain-chance">♧ %{data.daily.precipitation_probability_max[i]}</span><span className="temp-range"><b>{Math.round(data.daily.temperature_2m_max[i])}°</b><em>{Math.round(data.daily.temperature_2m_min[i])}°</em></span><span className="chev">⌄</span></button>{expandedDay===i&&<div className="day-detail"><span>Rüzgâr {Math.round(data.daily.wind_speed_10m_max[i])} km/s</span><span>UV {Math.round(data.daily.uv_index_max[i])}</span><span>Gün doğumu {fmtTime(data.daily.sunrise[i])}</span><span>Gün batımı {fmtTime(data.daily.sunset[i])}</span></div>}</div>)}</div>
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
