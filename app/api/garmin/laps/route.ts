import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
const BASE='https://personal.connectapi.garmin.com';
type Lap={startTimeGMT?:string;distance?:number;duration?:number;elapsedDuration?:number;averageHR?:number;maxHR?:number;averageRunCadence?:number;averagePower?:number;elevationGain?:number};
export async function POST(req:NextRequest){
 try{
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return NextResponse.json({error:'Login required'},{status:401});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||'',process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'',{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await db.auth.getUser(auth.slice(7));
  if(authError||!user)return NextResponse.json({error:'Invalid session'},{status:401});
  const {data:member}=await db.from('app_members').select('user_id').eq('user_id',user.id).maybeSingle();
  if(!member)return NextResponse.json({error:'Not authorized'},{status:403});
  const body=await req.json() as {activityId?:string};
  if(!body.activityId||!/^[-0-9a-f]{36}$/i.test(body.activityId))return NextResponse.json({error:'Invalid activity ID'},{status:400});
  const {data:activity}=await db.from('activities').select('id,source,source_activity_id').eq('id',body.activityId).eq('user_id',user.id).maybeSingle();
  if(!activity||activity.source!=='garmin'||!activity.source_activity_id||!/^\d+$/.test(activity.source_activity_id))return NextResponse.json({error:'Not a Garmin activity'},{status:400});
  const key=process.env.GARMIN_PERSONAL_API_KEY;
  if(!key)return NextResponse.json({error:'Garmin API key missing'},{status:503});
  const tokenRes=await fetch(BASE+'/personalapitoken-service/personal-api/personal-api-key/token',{method:'POST',headers:{Authorization:'ApiKey '+key},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!tokenRes.ok)return NextResponse.json({error:'Garmin authentication failed',status:tokenRes.status},{status:502});
  const tokenText=(await tokenRes.text()).trim();let token=tokenText;
  if(tokenText.startsWith('{')){const obj=JSON.parse(tokenText) as {access_token?:string;accessToken?:string};token=obj.access_token||obj.accessToken||''}
  token=token.replace(/^"|"$/g,'');
  if(!token)return NextResponse.json({error:'Garmin token missing'},{status:502});
  const res=await fetch(BASE+'/activity-service/activity/'+activity.source_activity_id+'/splits',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!res.ok)return NextResponse.json({error:'Garmin splits endpoint returned HTTP '+res.status+(res.status===404?' (activity splits not found or endpoint unsupported)':res.status===403?' (access denied by Garmin)':''),garminStatus:res.status},{status:502});
  const json=await res.json() as {lapDTOs?:Lap[];lapDTO?:Lap[];splits?:Lap[]}|Lap[];
  const laps=Array.isArray(json)?json:Array.isArray(json.lapDTOs)?json.lapDTOs:Array.isArray(json.lapDTO)?json.lapDTO:Array.isArray(json.splits)?json.splits:[];
  if(!laps.length)return NextResponse.json({error:'No lap records returned by Garmin',keys:Array.isArray(json)?[]:Object.keys(json).slice(0,12)},{status:422});
  const rows=laps.map((lap,i)=>({activity_id:activity.id,user_id:user.id,lap_index:i+1,start_time:lap.startTimeGMT?new Date(lap.startTimeGMT.replace(' ','T')+'Z').toISOString():null,distance_m:lap.distance??null,duration_s:lap.duration??lap.elapsedDuration??null,avg_hr:lap.averageHR??null,max_hr:lap.maxHR??null,avg_cadence:lap.averageRunCadence??null,avg_power:lap.averagePower??null,elevation_gain_m:lap.elevationGain??null}));
  const {error}=await db.from('activity_laps').upsert(rows,{onConflict:'activity_id,lap_index'});
  if(error)return NextResponse.json({error:'Cannot save laps: '+error.message},{status:500});
  return NextResponse.json({saved:rows.length});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not fetch Garmin laps'},{status:500})}
}
