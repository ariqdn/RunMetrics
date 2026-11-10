'use client';
import {useEffect,useState} from 'react';
import {createClient, type User} from '@supabase/supabase-js';
import {parseFit} from '../lib/fit';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
const db=url&&key?createClient(url,key):null;
type Activity={id:string;started_at:string;name:string;distance_m:number;duration_s:number;avg_hr:number|null;source:string};
const pace=(s:number,m:number)=>{if(!m||!s)return '—';const n=Math.round(s/(m/1000));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')+'/km'};
const fmt=(s:number)=>Math.floor(s/3600)+':'+String(Math.floor(s%3600/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
export default function Home(){
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[recovery,setRecovery]=useState(false),[notice,setNotice]=useState(''),[syncNotice,setSyncNotice]=useState(''),[syncError,setSyncError]=useState(''),[sent,setSent]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[runs,setRuns]=useState<Activity[]>([]),[lthr,setLthr]=useState(181);
 const [form,setForm]=useState({name:'Easy Run',date:new Date().toISOString().slice(0,10),distance:'5',duration:'30',hr:''});
 useEffect(()=>{if(!db){setReady(true);return}db.auth.getUser().then(({data})=>{setUser(data.user);setReady(true)});const {data:{subscription}}=db.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')setRecovery(true);setUser(session?.user||null)});return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!user||!db)return;const client=db;void (async()=>{const [{data:acts},{data:profile}]=await Promise.all([client.from('activities').select('id,started_at,name,distance_m,duration_s,avg_hr,source').order('started_at',{ascending:false}).limit(100),client.from('training_profiles').select('lthr').eq('user_id',user.id).maybeSingle()]);setRuns((acts||[]) as Activity[]);if(profile)setLthr(profile.lthr)})()},[user]);
 async function signIn(e:React.FormEvent){e.preventDefault();if(!db)return;setBusy(true);setError('');setNotice('');const {error:err}=await db.auth.signInWithPassword({email,password});setBusy(false);if(err)setError(err.message)}
 async function resetPassword(){if(!db||!email)return;setBusy(true);setError('');const {error:err}=await db.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});setBusy(false);if(err)setError(err.message);else setNotice('If this email is registered, a password reset link will arrive. Email limits may delay sending.')}
 async function updatePassword(e:React.FormEvent){e.preventDefault();if(!db||password.length<12){setError('Use a password with at least 12 characters');return}setBusy(true);setError('');const {error:err}=await db.auth.updateUser({password});setBusy(false);if(err)setError(err.message);else{setRecovery(false);setPassword('');setNotice('Password saved successfully. You can now use email and password to sign in.')}}
 async function add(e:React.FormEvent){e.preventDefault();if(!db||!user)return;setBusy(true);setError('');const {data,error:err}=await db.from('activities').insert({user_id:user.id,name:form.name,started_at:new Date(form.date+'T07:00:00').toISOString(),distance_m:Number(form.distance)*1000,duration_s:Math.round(Number(form.duration)*60),avg_hr:form.hr?Number(form.hr):null,source:'manual'}).select('id,started_at,name,distance_m,duration_s,avg_hr,source').single();setBusy(false);if(err)setError(err.message);else if(data)setRuns(prev=>[data as Activity,...prev])}
 async function importFit(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file||!db||!user)return;
  setBusy(true);setError('');
  try{
   if(!file.name.toLowerCase().endsWith('.fit'))throw Error('Select a .fit file');
   if(file.size>30*1024*1024)throw Error('FIT file must be under 30 MB');
   const buffer=await file.arrayBuffer(), parsed=parseFit(buffer);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const {data,error:err}=await db.from('activities').insert({...parsed,user_id:user.id,name:file.name.replace(/\\.fit$/i,''),source:'fit',source_activity_id:hash}).select('id,started_at,name,distance_m,duration_s,avg_hr,source').single();
   if(err)throw Error(err.code==='23505'?'This FIT activity was already imported':err.message);
   if(data)setRuns(prev=>[data as Activity,...prev]);
  }catch(ex){setError(ex instanceof Error?ex.message:'FIT import failed')}finally{setBusy(false);e.target.value=''}
 }
 async function saveLthr(){if(!db||!user)return;setError('');const {error:err}=await db.from('training_profiles').upsert({user_id:user.id,lthr,updated_at:new Date().toISOString()});if(err)setError(err.message)}
 async function syncGarmin(){
  if(!db||!user)return;setBusy(true);setSyncError('');setSyncNotice('Syncing Garmin activities…');
  try{
   const {data:{session}}=await db.auth.getSession();if(!session)throw Error('Please sign in again');
   const response=await fetch('/api/garmin/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({start:0,limit:50})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Garmin sync failed');
   const {data:activities,error:err}=await db.from('activities').select('id,started_at,name,distance_m,duration_s,avg_hr,source').order('started_at',{ascending:false}).limit(100);
   if(err)throw Error(err.message);setRuns((activities||[]) as Activity[]);
   setSyncNotice('Garmin sync complete: '+result.imported+' imported, '+result.skipped+' already present. Scroll down to Activities.');
  }catch(ex){setSyncNotice('');setSyncError(ex instanceof Error?ex.message:'Garmin sync failed')}finally{setBusy(false)}
 }
 const total=runs.reduce((a,r)=>a+Number(r.distance_m),0),seconds=runs.reduce((a,r)=>a+r.duration_s,0);
 return <main className="wrap">
 <header className="header"><div className="brand">◉ RunMetrics <span className="pill">v3 MVP</span></div>{user&&<button onClick={()=>db?.auth.signOut()}>Sign out</button>}</header>
 {!db?<section className="card top"><h2>Configuration required</h2><p className="muted">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.</p></section>:
 !ready?<p>Loading…</p>:recovery?<section className="card auth stack"><h1>Set your password</h1><p className="muted">Choose a new password (12 characters or more) for RunMetrics.</p><form onSubmit={updatePassword} className="stack"><label>New password<input type="password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label><button disabled={busy}>{busy?'Saving…':'Save password'}</button></form>{error&&<p className="error">{error}</p>}</section>:!user?<section className="card auth stack"><h1>Welcome back</h1><p className="muted">Sign in to your private running dashboard with your email and password.</p><form onSubmit={signIn} className="stack"><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><button type="button" disabled={busy||!email} onClick={resetPassword}>Set / forgot password? Send reset link</button>{notice&&<p className="success">{notice}</p>}{error&&<p className="error">{error}</p>}</section>:
 <><section className="top"><h1>Road to JRF 2027</h1><p className="muted">Full Marathon · Goal 3:45:00 · Target pace 5:20/km</p></section>
 <div className="grid"><div className="card"><div className="muted">Recorded distance</div><div className="number">{(total/1000).toFixed(1)} km</div></div><div className="card"><div className="muted">Activities</div><div className="number">{runs.length}</div></div><div className="card"><div className="muted">Average pace</div><div className="number">{pace(seconds,total)}</div></div><div className="card"><div className="muted">LTHR reference</div><div className="number">{lthr} bpm</div></div></div>
 <section className="card top"><h2>Garmin Connect Sync</h2><p className="hint">Secure server-side Garmin Personal API connection. Import the 50 most recent activities; duplicates are skipped.</p><button disabled={busy} onClick={syncGarmin}>{busy?'Syncing…':'Sync Garmin history'}</button>{syncNotice&&<p className="success" role="status">{syncNotice}</p>}{syncError&&<p className="error" role="alert">{syncError}</p>}</section>
 <section className="card top"><h2>Import Garmin FIT</h2><p className="hint">Upload a Garmin .fit activity (up to 30 MB). The file is parsed in your browser; session summary is saved to Supabase. Duplicate file imports are blocked. Original FIT files are not yet archived.</p><label>FIT activity file<input type="file" accept=".fit" disabled={busy} onChange={importFit}/></label>{busy&&<p className="muted">Processing…</p>}</section>
 <section className="card top"><h2>Add a run</h2><p className="hint">Manual entry and basic FIT session import are available. Automatic Garmin/Strava sync is not yet implemented.</p><form className="form" onSubmit={add}><label>Activity<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Date<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Distance (km)<input type="number" min=".01" step=".01" required value={form.distance} onChange={e=>setForm({...form,distance:e.target.value})}/></label><label>Duration (minutes)<input type="number" min=".1" step=".1" required value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}/></label><label>Average HR<input type="number" min="30" max="240" value={form.hr} onChange={e=>setForm({...form,hr:e.target.value})}/></label><button disabled={busy}>Save activity</button></form>{error&&<p className="error">{error}</p>}</section>
 <section className="card top"><h2>Activities</h2>{runs.length===0?<p className="muted">No activities yet. Add your first run above.</p>:<div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Date</th><th>Activity</th><th>Distance</th><th>Time</th><th>Pace</th><th>HR</th></tr></thead><tbody>{runs.map(r=><tr key={r.id}><td>{new Date(r.started_at).toLocaleDateString('id-ID')}</td><td>{r.name}</td><td>{(r.distance_m/1000).toFixed(2)} km</td><td>{fmt(r.duration_s)}</td><td>{pace(r.duration_s,r.distance_m)}</td><td>{r.avg_hr||'—'}</td></tr>)}</tbody></table></div>}</section>
 <section className="card top"><h2>Training profile</h2><div className="form"><label>Operational LTHR (bpm)<input type="number" min="100" max="230" value={lthr} onChange={e=>setLthr(Number(e.target.value))}/></label><button onClick={saveLthr}>Save LTHR</button></div><p className="hint">Effective-dated threshold history and advanced analytics are planned for a later phase.</p></section>
 <section className="card top"><h2>Coming next</h2><p className="muted">FIT laps/records and GPS · Aerobic efficiency · Race predictor · Hybrid AI Coach · Training journal · Garmin & Strava integrations.</p></section></>}
 </main>
}