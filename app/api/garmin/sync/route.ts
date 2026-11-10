import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export const maxDuration=60;
const BASE='https://personal.connectapi.garmin.com';
type GarminActivity={activityId?:number;activityName?:string;startTimeGMT?:string;startTimeLocal?:string;distance?:number;duration?:number;averageHR?:number;totalElevationGain?:number;activityType?:{typeKey?:string}};
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
  const tokenBody=await tokenResponse.json() as {access_token?:string;accessToken?:string};
  const token=tokenBody.access_token||tokenBody.accessToken;
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
  let imported=0,skipped=0;
  for(const a of activities){
   const {error}=await supabase.from('activities').insert(a);
   if(error?.code==='23505')skipped++;
   else if(error)return NextResponse.json({error:'Database import failed: '+error.message,imported,skipped},{status:500});
   else imported++;
  }
  return NextResponse.json({fetched:list.length,imported,skipped,nextStart:start+list.length,hasMore:list.length===limit});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Garmin sync failed'},{status:500})}
}
