'use client';
import {useMemo,useState} from 'react';
type Run={id:string;started_at:string;name:string;distance_m:number;duration_s:number;avg_hr:number|null};
const km=(m:number)=>(m/1000).toFixed(1);
const pace=(s:number,m:number)=>{const n=Math.round(s/(m/1000));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')+'/km'};
function weekKey(date:string){const d=new Date(date);const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return d.toISOString().slice(0,10)}
export default function PerformanceTrends({runs}:{runs:Run[]}){
 const [windowDays,setWindowDays]=useState(56);
 const report=useMemo(()=>{
  const now=Date.now(),start=now-windowDays*86400000;
  const filtered=runs.filter(r=>{const t=Date.parse(r.started_at);return t>=start&&t<=now&&r.distance_m>0&&r.duration_s>0});
  const weeks=new Map<string,{week:string;distance:number;count:number;duration:number}>();
  for(const r of filtered){const w=weekKey(r.started_at),v=weeks.get(w)||{week:w,distance:0,count:0,duration:0};v.distance+=r.distance_m;v.duration+=r.duration_s;v.count++;weeks.set(w,v)}
  const weekly=[...weeks.values()].sort((a,b)=>a.week.localeCompare(b.week));
  const comparable=filtered.filter(r=>r.avg_hr!==null&&r.avg_hr>0&&r.distance_m>=3000&&r.distance_m<=12000&&r.duration_s>=900&&/\b(easy|recovery|base|z2|zone 2)\b/i.test(r.name)).sort((a,b)=>a.started_at.localeCompare(b.started_at));
  const half=Math.floor(comparable.length/2),early=comparable.slice(0,half),late=comparable.slice(-half);
  const weighted=(arr:Run[])=>({pace:arr.reduce((s,r)=>s+r.duration_s,0)/(arr.reduce((s,r)=>s+r.distance_m,0)/1000),hr:arr.reduce((s,r)=>s+(r.avg_hr||0)*r.duration_s,0)/arr.reduce((s,r)=>s+r.duration_s,0)});
  return {filtered,weekly,comparable,comparison:half>=2?{early:weighted(early),late:weighted(late)}:null};
 },[runs,windowDays]);
 const total=report.filtered.reduce((s,r)=>s+r.distance_m,0),longest=Math.max(0,...report.filtered.map(r=>r.distance_m));
 const maxWeek=Math.max(1,...report.weekly.map(w=>w.distance));
 const comparison=report.comparison;
 return <section className="card top"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><h2>Performance Trends</h2><label>Period <select value={windowDays} onChange={e=>setWindowDays(Number(e.target.value))}><option value={28}>28 days</option><option value={56}>56 days</option><option value={90}>90 days</option></select></label></div><p className="hint">Historical activity trends from up to 100 activities loaded in RunMetrics. Weeks are grouped Monday–Sunday (UTC); partial weeks and incomplete sync may affect totals.</p><div className="grid"><div className="card"><div className="muted">Total distance</div><div className="number">{km(total)} km</div></div><div className="card"><div className="muted">Activities</div><div className="number">{report.filtered.length}</div></div><div className="card"><div className="muted">Longest recorded run</div><div className="number">{km(longest)} km</div></div></div>{report.weekly.length>0?<div style={{marginTop:16}}><h3>Weekly mileage</h3><div style={{display:'flex',alignItems:'end',gap:8,minHeight:150,overflowX:'auto',paddingBottom:8}}>{report.weekly.map(w=><div key={w.week} style={{minWidth:56,flex:1,textAlign:'center'}}><div className="hint">{km(w.distance)} km</div><div style={{height:Math.max(5,w.distance/maxWeek*105),background:'#38bdf8',borderRadius:'5px 5px 0 0'}} title={w.count+' runs'}/><div className="hint">{w.week.slice(5)}</div></div>)}</div><p className="hint">Each bar shows recorded distance for a week starting on the labeled Monday. Missing weeks are not necessarily rest weeks.</p></div>:<p className="hint">No recorded activities in this period.</p>}<h3>Comparable easy-run signal</h3>{comparison?<><p>Earlier sessions: <strong>{pace(comparison.early.pace*1000,1000)}</strong> at {Math.round(comparison.early.hr)} bpm. Later sessions: <strong>{pace(comparison.late.pace*1000,1000)}</strong> at {Math.round(comparison.late.hr)} bpm.</p><p className="hint">Based on {report.comparable.length} named easy/recovery/base runs of 3–12 km, split into earlier and later groups. Faster pace with similar HR may be encouraging, but weather, route, terrain, and fatigue are not controlled; this is not a validated aerobic-efficiency score.</p></>:<p className="hint">Need at least 4 comparable runs named Easy, Recovery, Base, or Z2, with HR and distances 3–12 km, to show an early-vs-late comparison. No fabricated trend is displayed.</p>}</section>
}
