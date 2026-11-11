export type ImportedLap={lap_index:number;start_time:string|null;distance_m:number|null;duration_s:number|null;avg_hr:number|null;max_hr:number|null;avg_cadence:number|null;avg_power:number|null;elevation_gain_m:number|null};
export function parseTcx(text:string){
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('Invalid TCX XML');
 const nodes=Array.from(doc.getElementsByTagName('*'));
 const local=(el:Element)=>el.localName;
 const children=(el:Element,name:string)=>Array.from(el.children).find(c=>local(c)===name);
 const descendants=(el:Element,name:string)=>Array.from(el.getElementsByTagName('*')).filter(c=>local(c)===name);
 const value=(el:Element,name:string)=>{const child=children(el,name);return child?.textContent?.trim()||''};
 const number=(s:string)=>s!==''&&Number.isFinite(Number(s))?Number(s):null;
 const activities=nodes.filter(n=>local(n)==='Activity');
 const activity=activities[0];if(!activity)throw Error('No activity found in TCX');
 const lapNodes=Array.from(activity.children).filter(n=>local(n)==='Lap');
 if(!lapNodes.length)throw Error('No lap records in TCX');
 const laps:ImportedLap[]=lapNodes.map((lap,i)=>{
  const hr=children(lap,'AverageHeartRateBpm'),max=children(lap,'MaximumHeartRateBpm');
  const cadence=number(value(lap,'Cadence'));
  const runCadence=descendants(lap,'AvgRunCadence')[0];
  const extension=runCadence||descendants(lap,'AvgCadence')[0];
  const power=descendants(lap,'AvgWatts')[0];
  const distance=number(value(lap,'DistanceMeters')),duration=number(value(lap,'TotalTimeSeconds'));
  return {lap_index:i+1,start_time:lap.getAttribute('StartTime')||null,distance_m:distance,duration_s:duration,avg_hr:hr?number(value(hr,'Value')):null,max_hr:max?number(value(max,'Value')):null,avg_cadence:extension?((n)=>n===null?null:runCadence?n*2:n)(number(extension.textContent?.trim()||'')):cadence,avg_power:power?number(power.textContent?.trim()||''):null,elevation_gain_m:null};
 });
 const id=value(activity,'Id');
 const started_at=id&&Number.isFinite(Date.parse(id))?new Date(id).toISOString():laps[0].start_time;
 const distance_m=laps.reduce((s,l)=>s+(l.distance_m||0),0);
 const duration_s=laps.reduce((s,l)=>s+(l.duration_s||0),0);
 return {started_at,distance_m,duration_s,laps};
}
