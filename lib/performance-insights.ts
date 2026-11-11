import type {WorkoutType} from './workout-intelligence';
type Run={distance_m:number;duration_s:number;avg_hr:number|null};
type Lap={distance_m:number|null;duration_s:number|null;avg_hr:number|null;avg_cadence:number|null;avg_power:number|null};
type Insight={title:string;detail:string;level:'positive'|'focus'|'neutral'};
export function performanceInsights(run:Run,laps:Lap[],type:WorkoutType,lthr:number):{insights:Insight[];limitations:string[]}{
 const insights:Insight[]=[],limitations:string[]=[];
 const valid=laps.filter(l=>l.distance_m!==null&&l.duration_s!==null&&l.distance_m>=400&&l.duration_s>=90).map(l=>({...l,pace:l.duration_s!/(l.distance_m!/1000)})).filter(l=>Number.isFinite(l.pace)&&l.pace>0);
 const ratios=run.avg_hr!==null&&lthr>0?run.avg_hr/lthr:null;
 if(valid.length>=3){
  const first=valid[0],last=valid[valid.length-1];
  const improvement=(first.pace-last.pace)/first.pace;
  const paceValues=valid.map(l=>l.pace),mean=paceValues.reduce((a,b)=>a+b,0)/paceValues.length;
  const variability=Math.sqrt(paceValues.reduce((a,b)=>a+(b-mean)**2,0)/paceValues.length)/mean;
  if(improvement>=.08)insights.push({title:'Pace progression',detail:'Meaningful laps accelerated '+Math.round(improvement*100)+'% from first to last. Check whether this matches the intended session.',level:type==='progression'?'positive':'neutral'});
  else if(improvement<=-.08)insights.push({title:'Late-session slowdown',detail:'Last meaningful lap was '+Math.round(-improvement*100)+'% slower than the first. This may reflect fatigue, terrain, or workout structure.',level:'focus'});
  if(variability<.05)insights.push({title:'Consistent lap pacing',detail:'Pace variability is low across comparable laps ('+Math.round(variability*100)+'% coefficient of variation).',level:'positive'});
  else if(variability>.12&&type==='easy')insights.push({title:'Easy-run pacing consistency',detail:'Lap pace varies substantially ('+Math.round(variability*100)+'%). Consider steadier effort if terrain and conditions allow.',level:'focus'});
  const a=valid[valid.length-2],b=valid[valid.length-1];
  if(a.avg_hr!==null&&b.avg_hr!==null&&b.pace<a.pace*.95&&b.avg_hr<=a.avg_hr+2)insights.push({title:'Faster at similar lap HR',detail:'Last lap improved pace while average HR changed by no more than 2 bpm. Encouraging, but not proof of improved running economy.',level:'positive'});
  const cadences=valid.map(l=>l.avg_cadence).filter((x):x is number=>x!==null&&x>0);
  if(cadences.length>=3){const avg=cadences.reduce((a,b)=>a+b,0)/cadences.length;const range=Math.max(...cadences)-Math.min(...cadences);insights.push({title:'Cadence consistency',detail:'Average '+Math.round(avg)+' spm across measured laps; range '+Math.round(range)+' spm. No universal cadence target is assumed.',level:'neutral'});}
 }else limitations.push('At least three meaningful laps (≥400 m, ≥90 s) are needed for pacing and cadence analysis.');
 if(ratios!==null){
  if((type==='easy'||type==='recovery')&&ratios>=.91)insights.push({title:'Intensity above easy target',detail:'Session-average HR was '+Math.round(ratios*100)+'% of LTHR. Check workout intent, weather, elevation, and HR sensor accuracy.',level:'focus'});
  else if(type==='tempo'&&ratios>=.91)insights.push({title:'Tempo intensity signal',detail:'Average HR was '+Math.round(ratios*100)+'% of LTHR, compatible with sustained harder effort; lap structure still matters.',level:'neutral'});
 }else limitations.push('No activity-average HR or valid LTHR for intensity analysis.');
 if(type==='other')insights.push({title:'Confirm workout purpose',detail:'Workout type is uncertain. Correct it in Workout Intelligence to make recommendations more relevant.',level:'focus'});
 if(type==='easy'||type==='recovery')insights.push({title:'Next training focus',detail:'Prioritize conversational effort and recovery; compare similar routes and conditions over multiple easy runs rather than chasing pace.',level:'neutral'});
 else if(type==='tempo')insights.push({title:'Next training focus',detail:'Review whether the intended tempo segments were steady. Warm-up and cooldown laps should not be graded as tempo intervals.',level:'neutral'});
 else if(type==='interval')insights.push({title:'Next training focus',detail:'Compare work intervals separately from recovery intervals; lap averages alone cannot reliably identify every work rep.',level:'neutral'});
 else insights.push({title:'Next training focus',detail:'Compare this workout with previous sessions of the same type before increasing volume or intensity.',level:'neutral'});
 limitations.push('These insights use activity/lap averages, not GPS trackpoints; no valid HR drift, time-in-zone, or causal fitness change is inferred.');
 return {insights,limitations};
}
