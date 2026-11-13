import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export const maxDuration=60;
const BASE='https://personal.connectapi.garmin.com';
type GarminActivity={activityId?:number;activityName?:string;startTimeGMT?:string;startTimeLocal?:string;distance?:number;duration?:number;averageHR?:number;totalElevationGain?:number;vO2MaxValue?:number;vo2MaxValue?:number;activityType?:{typeKey?:string}};
export async function POST(req:NextRequest){
 try{
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return NextResponse.json({error:'Login required'},{status:401});
  const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||'',process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'',{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await supabase.auth.getUser(auth.slice(7));
  if(authError||!user)return NextResponse.json({error:'Invalid session'},{status:401});
  const {data:member,error:memberError}=await supabase.from('app_members').select('user_id').eq('user_id',user.id).maybeSingle();
  if(memberError||!member)return NextResponse.json({error:'Access restricted'},{status:403});
  const key=process.env.GARMIN_PERSONAL_API_KEY;
  if(!key)return NextResponse.json({error:'Garmin API key is not configured'},{status:503});
  const tokenResponse=await fetch(BASE+'/personalapitoken-service/personal-api/personal-api-key/token',{method:'POST',headers:{Authorization:'ApiKey '+key},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!tokenResponse.ok)return NextResponse.json({error:'Garmin token request failed',status:tokenResponse.status},{status:502});
  const tokenText=(await tokenResponse.text()).trim();
  let token=tokenText;
  if(tokenText.startsWith('{')){
   const tokenBody=JSON.parse(tokenText) as {access_token?:string;accessToken?:string;token?:string};
   token=tokenBody.access_token||tokenBody.accessToken||tokenBody.token||'';
  }
  token=token.replace(/^\"|\"$/g,'');
  if(!token)return NextResponse.json({error:'Garmin did not return an access token'},{status:502});
  const body=await req.json().catch(()=>({})) as {start?:number;limit?:number};
  const start=Math.max(0,Math.min(10000,Math.floor(Number(body.start)||0)));
  const limit=Math.max(1,Math.min(100,Math.floor(Number(body.limit)||50)));
  const query=new URLSearchParams({start:String(start),limit:String(limit)});
  const response=await fetch(BASE+'/activitylist-service/activities/search/activities?'+query,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)return NextResponse.json({error:'Garmin activities request failed',status:response.status},{status:502});
  const raw=await response.json() as unknown;
  const list=Array.isArray(raw)?raw:Array.isArray((raw as {activities?:unknown})?.activities)?(raw as {activities:GarminActivity[]}).activities:[];
  const activities=(list as GarminActivity[]).filter(a=>a.activityId&&a.distance&&a.duration&&a.startTimeGMT).map(a=>({
   user_id:user.id,source:'garmin',source_activity_id:String(a.activityId),name:(a.activityName||'Garmin Activity').slice(0,180),
   started_at:new Date(a.startTimeGMT!.replace(' ','T')+'Z').toISOString(),distance_m:a.distance!,duration_s:Math.round(a.duration!),
   avg_hr:a.averageHR&&a.averageHR>0?Math.round(a.averageHR):null,
   elevation_gain_m:a.totalElevationGain??null
  }));
  let imported=0,skipped=0,vo2maxSaved=0;
  // Only store VO2max when Garmin explicitly supplies a numeric value in the activity response.
  // Activity summaries may omit this metric entirely; never infer it from pace or HR.
  const vo2Readings=(list as GarminActivity[]).filter(a=>a.startTimeGMT&&a.activityType?.typeKey?.toLowerCase().includes('running')).map(a=>({date:a.startTimeGMT!.slice(0,10),value:a.vO2MaxValue??a.vo2MaxValue})).filter((v):v is {date:string;value:number}=>typeof v.value==='number'&&Number.isFinite(v.value)&&v.value>=15&&v.value<=95);
  for(const a of activities){
   const {error}=await supabase.from('activities').insert(a);
   if(error?.code==='23505')skipped++;
   else if(error)return NextResponse.json({error:'Database import failed: '+error.message,imported,skipped},{status:500});
   else imported++;
  }
  for(const reading of vo2Readings){const {error}=await supabase.from('vo2max_readings').upsert({user_id:user.id,measured_on:reading.date,vo2max:reading.value,source:'garmin_auto'},{onConflict:'user_id,measured_on,source'});if(!error)vo2maxSaved++;}
  return NextResponse.json({fetched:list.length,imported,skipped,vo2maxSaved,vo2maxAvailableInResponse:vo2Readings.length>0,nextStart:start+list.length,hasMore:list.length===limit});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Garmin sync failed'},{status:500})}
}
