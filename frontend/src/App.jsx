import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const incidentTypes = [
  { value: "traffic_accident", label: "อุบัติเหตุทางถนน", icon: "🚗" },
  { value: "fire", label: "ไฟไหม้", icon: "🔥" },
  { value: "medical", label: "เจ็บป่วย / ฉุกเฉิน", icon: "🚑" },
  { value: "crime", label: "เหตุร้าย / อาชญากรรม", icon: "🚨" },
  { value: "other", label: "เหตุอื่น ๆ", icon: "📌" }
];
const statusMap = {
  NEW: { label: "รับเรื่องใหม่", cls: "new" },
  IN_PROGRESS: { label: "กำลังดำเนินการ", cls: "progress" },
  RESOLVED: { label: "เสร็จสิ้น", cls: "resolved" }
};

function Login({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message || "เข้าสู่ระบบไม่สำเร็จ");
      localStorage.setItem("incident_token", d.token); onLogin(d.user);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  return <div className="login-page"><form className="login-card" onSubmit={submit}>
    <div className="login-logo">🚨</div><h1>ระบบเจ้าหน้าที่</h1><p>Incident Reporting Dashboard</p>
    <label>ชื่อผู้ใช้<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></label>
    <label>รหัสผ่าน<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
    {error && <div className="alert error">⚠️ {error}</div>}

    <button className="submit" disabled={loading}>{loading ? "กำลังเข้าสู่ระบบ..." : "🔐 เข้าสู่ระบบ"}</button>
    <div className="demo-login">บัญชีทดสอบ: <b>admin / admin123</b><br/>เจ้าหน้าที่: <b>officer / officer123</b></div>
  </form></div>;
}

function Dashboard({ user, onLogout }) {
  const [incidents, setIncidents] = useState([]);
  const [summary, setSummary] = useState({ total: 0, new: 0, in_progress: 0, resolved: 0, by_type: [], by_day: [] });
  const [filter, setFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [sortOrder, setSortOrder] = useState("DESC");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const token = localStorage.getItem("incident_token");
  const headers = { Authorization: `Bearer ${token}` };
    const selectedIncident = incidents.find(i => i.id === selectedId);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`${API_BASE}/api/incidents`, { headers }),
        fetch(`${API_BASE}/api/dashboard/summary`, { headers })
      ]);
      if (a.status === 401 || b.status === 401) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      const ia = await a.json();
      const sb = await b.json();
      if (!a.ok) throw new Error(ia.message || "ไม่สามารถโหลดรายการเหตุได้");
      if (!b.ok) throw new Error(sb.message || "โหลดสถิติไม่สำเร็จ");
      setIncidents(ia);
      setSummary(sb);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  async function changeStatus(id, status) {
    try {
      const r = await fetch(`${API_BASE}/api/incidents/${id}/status`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "เปลี่ยนสถานะไม่สำเร็จ");
      setIncidents(x => x.map(i => i.id === id ? d : i));
      setSelectedId(id);
      setTimeout(load, 100);
    } catch (e) {
      setError(e.message);
    }
  }

 const filtered = useMemo(() => {
  const keyword = search.trim().toLowerCase();

  const result = incidents.filter(i => {
    const matchesStatus =
      filter === "ALL" || i.status === filter;

    const typeLabel =
      (incidentTypes.find(x => x.value === i.type) || {}).label || "";

    const matchesSearch =
      !keyword ||
      String(i.incident_number || "").toLowerCase().includes(keyword) ||
      String(i.description || "").toLowerCase().includes(keyword) ||
      typeLabel.toLowerCase().includes(keyword);

    return matchesStatus && matchesSearch;
  });

  return [...result].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();

    return sortOrder === "DESC"
      ? dateB - dateA
      : dateA - dateB;
  });
}, [incidents, filter, search, sortOrder]);

  return <div className="app dashboard">
    <header className="topbar">
      <div className="brand-icon">🚨</div>
      <div><h1>Dashboard เจ้าหน้าที่</h1><p>ศูนย์รับแจ้งเหตุ</p></div>
      <div className="user-area"><span>{user.display_name} · {user.role}</span><button className="logout" onClick={onLogout}>ออกจากระบบ</button></div>
    </header>

    <main className="container wide">
      <div className="stats">
        <Stat title="เหตุทั้งหมด" value={summary.total}/>
        <Stat title="รับเรื่องใหม่" value={summary.new}/>
        <Stat title="กำลังดำเนินการ" value={summary.in_progress}/>
        <Stat title="เสร็จสิ้น" value={summary.resolved}/>
      </div>

      <section className="stats-grid">
        <section className="card analytics-card">
          <div className="section-title-row"><div><h2>📊 ประเภทเหตุการณ์</h2><p>สัดส่วนเหตุทั้งหมดแยกตามประเภท</p></div></div>
          <TypeStats data={summary.by_type || []} total={Number(summary.total || 0)}/>
        </section>
        <section className="card analytics-card">
          <div className="section-title-row"><div><h2>📈 แนวโน้ม 7 วันล่าสุด</h2><p>จำนวนเหตุที่แจ้งเข้ามาในแต่ละวัน</p></div></div>
          <DailyStats data={summary.by_day || []}/>
        </section>
      </section>

      <section className="card map-card">
        <div className="section-title-row">
          <div><h2>🗺️ แผนที่เหตุการณ์</h2><p>จุดเหตุทั้งหมดที่แสดงจะตรงกับตัวกรองด้านล่าง</p></div>
          <button className="secondary" onClick={load}>↻ รีเฟรช</button>
        </div>
        <DashboardMap incidents={filtered} selectedId={selectedId} onSelect={setSelectedId}/>
        <div className="map-legend">
          <span><i className="legend-dot new"/> รับเรื่องใหม่</span>
          <span><i className="legend-dot progress"/> กำลังดำเนินการ</span>
          <span><i className="legend-dot resolved"/> เสร็จสิ้น</span>
        </div>
      </section>

      <section className="card">
        <div className="section-title-row">
          <div><h2>📋 รายการเหตุการณ์</h2><p>ระบบรีเฟรชอัตโนมัติทุก 10 วินาที · คลิกรายการเพื่อดูตำแหน่งบนแผนที่</p></div>
        </div>
                <div className="filters">
          {[["ALL","ทั้งหมด"],["NEW","รับเรื่องใหม่"],["IN_PROGRESS","กำลังดำเนินการ"],["RESOLVED","เสร็จสิ้น"]].map(([v,l]) =>
            <button
              key={v}
              className={filter===v ? "filter active" : "filter"}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          )}
        </div>

<div className="sort-box">
  <label htmlFor="sort-order">เรียงลำดับ:</label>
  <select
    id="sort-order"
    value={sortOrder}
    onChange={e => setSortOrder(e.target.value)}
  >
    <option value="DESC">ใหม่ล่าสุด</option>
    <option value="ASC">เก่าสุด</option>
  </select>
</div>
    
<div className="search-box">
  <input
    value={search}
    onChange={e => setSearch(e.target.value)}
    placeholder="🔎 ค้นหาเลขที่เหตุ รายละเอียด หรือประเภท..."
  />

  {search && (
    <button
      type="button"
      className="clear-search"
      onClick={() => setSearch("")}
    >
      ✕
    </button>
  )}
</div>

<div className="result-count">
  พบ <strong>{filtered.length}</strong> รายการ
  {search.trim() && ` จากทั้งหมด ${incidents.length} รายการ`}
</div>

        {error && <div className="alert error">⚠️ {error}</div>}
{selectedIncident && (
  <div className="incident-detail">
    <div className="section-title-row">
      <div>
        <h2>📋 รายละเอียดเหตุการณ์</h2>
        <p>ข้อมูลของเหตุการณ์ที่เลือก</p>
      </div>
      <button type="button" onClick={() => setSelectedId(null)}>
        ปิด
      </button>
    </div>

    <div className="detail-grid">
      <div>
        <span>เลขที่เหตุ</span>
        <strong>{selectedIncident.incident_number}</strong>
      </div>

      <div>
        <span>ประเภทเหตุการณ์</span>
        <strong>
          {(incidentTypes.find(x => x.value === selectedIncident.type) || incidentTypes[4]).label}
        </strong>
      </div>

      <div>
        <span>สถานะ</span>
        <strong>
          {(statusMap[selectedIncident.status] || statusMap.NEW).label}
        </strong>
      </div>

      <div>
        <span>วันที่แจ้ง</span>
        <strong>
          {new Date(selectedIncident.created_at).toLocaleString("th-TH")}
        </strong>
      </div>

      <div className="detail-full">
        <span>รายละเอียด</span>
        <strong>{selectedIncident.description || "-"}</strong>
      </div>

      <div className="detail-full">
        <span>พิกัด</span>
        <strong>
          {Number(selectedIncident.latitude).toFixed(6)},{" "}
          {Number(selectedIncident.longitude).toFixed(6)}
        </strong>
      </div>
    </div>
  </div>
)}
        {loading && !incidents.length ? <p>กำลังโหลดข้อมูล...</p> : !filtered.length ? <div className="empty">ยังไม่มีรายการเหตุการณ์</div> :
          <div className="incident-list">{filtered.map(i => <IncidentRow key={i.id} incident={i} onStatus={changeStatus} onSelect={setSelectedId} selected={selectedId === i.id}/>)}</div>}
      </section>
    </main>
  </div>;
}

function DashboardMap({ incidents, selectedId, onSelect }) {
  const mapRef = useRef(null);
  const mapObject = useRef(null);
  const markersRef = useRef(new Map());

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center: [13.7563, 100.5018], zoom: 6, zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
    }).addTo(map);
    mapObject.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    const resize = () => map.invalidateSize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      map.remove();
      mapObject.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapObject.current;
    if (!map || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(marker => marker.removeFrom(map));
    markersRef.current.clear();

    const valid = incidents.filter(i => Number.isFinite(Number(i.latitude)) && Number.isFinite(Number(i.longitude)));
    valid.forEach(incident => {
      const lat = Number(incident.latitude);
      const lng = Number(incident.longitude);
      const color = statusColor(incident.status);
      const type = incidentTypes.find(x => x.value === incident.type) || incidentTypes[4];
      const status = statusMap[incident.status] || statusMap.NEW;
      const marker = L.circleMarker([lat, lng], {
        radius: incident.id === selectedId ? 11 : 8,
        color: "#ffffff",
        weight: 3,
        fillColor: color,
        fillOpacity: 0.95
      }).addTo(map);
      marker.bindPopup(`
        <div class="map-popup">
          <strong>${escapeHtml(incident.incident_number)}</strong>
          <span class="popup-status" style="background:${color}">${escapeHtml(status.label)}</span>
          <h4>${escapeHtml(type.icon + " " + type.label)}</h4>
          <p>${escapeHtml(incident.description)}</p>
          <small>📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}</small>
        </div>
      `);
      marker.on("click", () => onSelect(incident.id));
      markersRef.current.set(incident.id, marker);
    });

    if (valid.length > 0) {
      if (valid.length === 1) {
        map.setView([Number(valid[0].latitude), Number(valid[0].longitude)], 15);
      } else {
        const bounds = L.latLngBounds(valid.map(i => [Number(i.latitude), Number(i.longitude)]));
        map.fitBounds(bounds.pad(0.15), { maxZoom: 15 });
      }
    } else {
      map.setView([13.7563, 100.5018], 6);
    }
  }, [incidents, selectedId, onSelect]);

  useEffect(() => {
    const marker = markersRef.current.get(selectedId);
    const incident = incidents.find(i => i.id === selectedId);
    if (marker && incident && mapObject.current) {
      mapObject.current.setView([Number(incident.latitude), Number(incident.longitude)], Math.max(mapObject.current.getZoom(), 15), { animate: true });
      marker.openPopup();
    }
  }, [selectedId, incidents]);

  return <div ref={mapRef} className="dashboard-map"/>;
}

function statusColor(status) {
  return status === "NEW" ? "#ef4444" : status === "IN_PROGRESS" ? "#8b5cf6" : "#16a34a";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
}

function TypeStats({data,total}){
  const labels = Object.fromEntries(incidentTypes.map(x => [x.value, x]));
  const max = Math.max(...data.map(x => Number(x.count)), 1);
  return <div className="type-stats">{incidentTypes.map(t => {
    const row = data.find(x => x.type === t.value);
    const count = Number(row?.count || 0);
    const pct = total ? Math.round(count / total * 100) : 0;
    return <div className="type-stat" key={t.value}>
      <div className="type-stat-head"><span>{t.icon} {t.label}</span><b>{count} <small>({pct}%)</small></b></div>
      <div className="bar-track"><div className="bar-fill" style={{width:`${Math.round(count/max*100)}%`}}/></div>
    </div>;
  })}</div>;
}

function DailyStats({data}){
  const max = Math.max(...data.map(x => Number(x.count)), 1);
  return <div className="daily-stats">{data.map(row => {
    const rawDate = String(row.date ?? "");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? new Date(`${rawDate}T00:00:00`)
      : new Date(rawDate);
    const label = Number.isNaN(date.getTime())
      ? rawDate
      : date.toLocaleDateString("th-TH", { day:"numeric", month:"short" });
    const count = Number(row.count || 0);
    return <div className="day-stat" key={row.date}>
      <div className="day-value">{count}</div>
      <div className="day-bar-wrap"><div className="day-bar" style={{height:`${Math.max(6, Math.round(count/max*120))}px`}}/></div>
      <div className="day-label">{label}</div>
    </div>;
  })}</div>;
}

function Stat({title,value}){return <div className="stat"><span>{title}</span><strong>{value}</strong></div>}
function IncidentRow({incident,onStatus,onSelect,selected}){const t=incidentTypes.find(x=>x.value===incident.type)||incidentTypes[4]; const s=statusMap[incident.status]||statusMap.NEW; return <article className={`incident-row ${selected?"selected":""}`} onClick={()=>onSelect(incident.id)}><div className="incident-main"><div className="incident-icon">{t.icon}</div><div><div className="incident-head"><b>{incident.incident_number}</b><span className={`status ${s.cls}`}>{s.label}</span></div><h3>{t.label}</h3><p>{incident.description}</p><small>📍 {Number(incident.latitude).toFixed(6)}, {Number(incident.longitude).toFixed(6)} · {new Date(incident.created_at).toLocaleString("th-TH")}</small></div></div><div className="incident-actions" onClick={e=>e.stopPropagation()}><a href={`https://www.openstreetmap.org/?mlat=${incident.latitude}&mlon=${incident.longitude}#map=18/${incident.latitude}/${incident.longitude}`} target="_blank" rel="noreferrer">🗺️ แผนที่</a><select value={incident.status} onChange={e=>onStatus(incident.id,e.target.value)}><option value="NEW">รับเรื่องใหม่</option><option value="IN_PROGRESS">กำลังดำเนินการ</option><option value="RESOLVED">เสร็จสิ้น</option></select></div></article>}

function CitizenForm(){
  const [type,setType]=useState(""); const [description,setDescription]=useState(""); const [position,setPosition]=useState(null); const [address,setAddress]=useState(""); const [loadingLocation,setLoadingLocation]=useState(false); const [saving,setSaving]=useState(false); const [result,setResult]=useState(null); const [error,setError]=useState("");
  const getLocation=()=>{setError(""); if(!navigator.geolocation)return setError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง"); setLoadingLocation(true); navigator.geolocation.getCurrentPosition(pos=>{const p={lat:+pos.coords.latitude.toFixed(7),lng:+pos.coords.longitude.toFixed(7)};setPosition(p);setAddress(`GPS: ${p.lat}, ${p.lng}`);setLoadingLocation(false)},err=>{setLoadingLocation(false);setError(err.code===1?"ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง กรุณาอนุญาต Location ในเบราว์เซอร์":"ไม่สามารถอ่านตำแหน่งได้ กรุณาลองอีกครั้ง")},{enableHighAccuracy:true,timeout:15000,maximumAge:0})};
  const save=async()=>{setError("");setResult(null);if(!type)return setError("กรุณาเลือกประเภทเหตุ");if(description.trim().length<3)return setError("กรุณากรอกรายละเอียดเหตุ");if(!position)return setError("กรุณากดส่งพิกัดและยืนยันตำแหน่งก่อน");setSaving(true);try{const r=await fetch(`${API_BASE}/api/incidents`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type,description,latitude:position.lat,longitude:position.lng,address})});const d=await r.json();if(!r.ok)throw new Error(d.message);setResult(d);setType("");setDescription("");setPosition(null);setAddress("")}catch(e){setError(e.message||"เชื่อมต่อระบบไม่ได้")}finally{setSaving(false)}};
  return <div className="app"><header className="topbar"><div className="brand-icon">🚨</div><div><h1>ศูนย์รับแจ้งเหตุ</h1><p>แจ้งเหตุง่าย ส่งพิกัดแม่นยำ</p></div><a className="staff-link" href="#staff">🔐 เจ้าหน้าที่</a></header><main className="container"><section className="card"><h2>1. เลือกประเภทเหตุ</h2><div className="type-grid">{incidentTypes.map(i=><button key={i.value} className={`type-button ${type===i.value?"selected":""}`} onClick={()=>setType(i.value)}><span>{i.icon}</span>{i.label}</button>)}</div></section><section className="card"><h2>2. รายละเอียดเหตุ</h2><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="เช่น รถชนกัน มีผู้บาดเจ็บ 2 คน อยู่หน้าตลาด..." rows={5}/></section><section className="card"><div className="section-title-row"><div><h2>3. ส่งพิกัดตำแหน่ง</h2><p>ระบบจะขอ Location จากโทรศัพท์ของคุณ</p></div><button className="location-button" onClick={getLocation} disabled={loadingLocation}>📍 {loadingLocation?"กำลังค้นหาตำแหน่ง...":"ส่งพิกัดของฉัน"}</button></div>{position&&<><div className="coordinates"><span>Latitude: {position.lat}</span><span>Longitude: {position.lng}</span></div><MapPicker position={position} onPositionChange={p=>{setPosition(p);setAddress(`GPS: ${p.lat}, ${p.lng}`)}}/><div className="map-actions"><button className="secondary" onClick={getLocation}>📍 ใช้ตำแหน่งปัจจุบัน</button><a className="secondary button-link" href={`https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=18/${position.lat}/${position.lng}`} target="_blank" rel="noreferrer">🗺️ เปิด OpenStreetMap</a></div><p className="hint">คุณสามารถลากหมุดบนแผนที่เพื่อปรับจุดเกิดเหตุได้</p></>}</section>{error&&<div className="alert error">⚠️ {error}</div>}{result&&<div className="alert success"><div className="success-icon">✓</div><div><strong>แจ้งเหตุสำเร็จ</strong><p>เลขที่แจ้งเหตุ: <b>{result.incident_number}</b></p><p>ระบบบันทึกพิกัดและรายละเอียดเรียบร้อยแล้ว</p></div></div>}<button className="submit" onClick={save} disabled={saving}>{saving?"กำลังบันทึก...":"🚨 ส่งแจ้งเหตุ"}</button><p className="footer-note">หากเป็นเหตุฉุกเฉินที่มีอันตรายต่อชีวิต โปรดติดต่อหน่วยงานฉุกเฉินในพื้นที่โดยตรงด้วย</p></main></div>;
}
function MapPicker({position,onPositionChange}){const mapRef=useRef(null),mapObject=useRef(null),markerRef=useRef(null);useEffect(()=>{if(!mapRef.current||!window.L)return;const L=window.L,c=position||{lat:16.7,lng:101.1};mapObject.current=L.map(mapRef.current,{center:[c.lat,c.lng],zoom:position?16:6});L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(mapObject.current);markerRef.current=L.marker([c.lat,c.lng],{draggable:true}).addTo(mapObject.current);markerRef.current.on("dragend",e=>{const p=e.target.getLatLng();onPositionChange({lat:+p.lat.toFixed(7),lng:+p.lng.toFixed(7)})});requestAnimationFrame(()=>mapObject.current?.invalidateSize());return()=>{mapObject.current?.remove();mapObject.current=null;markerRef.current=null}},[]);useEffect(()=>{if(mapObject.current&&markerRef.current&&position){const p=[position.lat,position.lng];mapObject.current.setView(p,Math.max(mapObject.current.getZoom(),16));markerRef.current.setLatLng(p)}},[position]);return <div ref={mapRef} className="map"/>}

export default function App(){const [user,setUser]=useState(null);useEffect(()=>{const t=localStorage.getItem("incident_token");if(t)fetch(`${API_BASE}/api/auth/me`,{headers:{Authorization:`Bearer ${t}`}}).then(r=>r.ok?r.json():Promise.reject()).then(d=>setUser(d.user)).catch(()=>localStorage.removeItem("incident_token"))},[]);const logout=()=>{localStorage.removeItem("incident_token");setUser(null)};if(location.hash==="#staff")return user?<Dashboard user={user} onLogout={logout}/>:<Login onLogin={setUser}/>;return <CitizenForm/>}
