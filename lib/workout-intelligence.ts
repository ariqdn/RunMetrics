export type WorkoutType='easy'|'recovery'|'tempo'|'interval'|'progression'|'long'|'race'|'fartlek'|'other';
export type Pattern='progressive pacing'|'positive split'|'steady pacing'|'variable pacing'|'insufficient lap data';
export type RunInput={name:string;distance_m:number;duration_s:number;avg_hr:number|null};
export type LapInput={distance_m:number|null;duration_s:number|null;avg_hr:number|null};
export const workoutLabels:Record<WorkoutType,string>={easy:'Easy Run',recovery:'Recovery Run',tempo:'Tempo / Threshold',interval:'Intervals',progression:'Progression Run',long:'Long Run',race:'Race',fartlek:'Fartlek',other:'Unclassified'};
export function detectWorkout(run:RunInput,laps:LapInput[],lthr:number){
 const name=run.name.toLowerCase();
 const keywords:{type:WorkoutType;re:RegExp}[]=[
  {type:'race',re:/\b(race|marathon|half marathon|10k race|5k race|event|lomba)\b/},
  {type:'interval',re:/\b(interval|repeats?|repetition|vo2max|speedwork|\d+x\d+)\b/},
  {type:'fartlek',re:/\bfartlek\b/},
  {type:'tempo',re:/\b(tempo|threshold|lactate|lt run|cruise)\b/},
  {type:'recovery',re:/\b(recovery|pemulihan|shakeout)\b/},
  {type:'long',re:/\b(long run|longrun|lsd|long slow distance)\b/},
  {type:'progression',re:/\b(progressive|progression|negative split)\b/},
  {type:'easy',re:/\b(easy|base run|aerobic run|z2|zone 2|santai)\b/}
 ];
 const named=keywords.find(k=>k.re.test(name));
 // Ignore tiny finishing laps; pace comparisons require meaningful duration and distance.
 const valid=laps.filter(l=>l.distance_m!==null&&l.duration_s!==null&&l.distance_m>=400&&l.duration_s>=90).map(l=>({pace:l.duration_s!/(l.distance_m!/1000),hr:l.avg_hr})).filter(l=>Number.isFinite(l.pace)&&l.pace>0);
 let pattern:Pattern='insufficient lap data',spread=0,trend=0,alternations=0;
 if(valid.length>=3){
  const p=valid.map(l=>l.pace);spread=(Math.max(...p)-Math.min(...p))/(p.reduce((a,b)=>a+b,0)/p.length);
  trend=(p[0]-p[p.length-1])/p[0];
  const changes=p.slice(1).map((x,i)=>x-p[i]).filter(x=>Math.abs(x)>8);
  alternations=changes.slice(1).filter((x,i)=>Math.sign(x)!==Math.sign(changes[i])).length;
  if(trend>=.08&&p.slice(1).filter((x,i)=>x<p[i]).length>=Math.ceil((p.length-1)*.65))pattern='progressive pacing';
  else if(trend<=-.08)pattern='positive split';
  else if(spread<.07)pattern='steady pacing';
  else pattern='variable pacing';
 }
 const ratio=run.avg_hr&&lthr>0?run.avg_hr/lthr:null;
 const reasons:string[]=[];
 let type:WorkoutType='other',confidence:'High'|'Medium'|'Low'='Low';
 if(named){type=named.type;confidence='High';reasons.push('Activity title includes '+workoutLabels[type]+' keyword (planned workout cue).')}
 else if(valid.length>=4&&alternations>=2&&spread>.13){type='interval';confidence='Medium';reasons.push('Repeated fast/slow lap changes suggest intervals.')}
 else if(pattern==='progressive pacing'){type='progression';confidence='Medium';reasons.push('Pace progressively accelerates across meaningful laps.')}
 else if(run.distance_m>=18000||run.duration_s>=105*60){type='long';confidence='Medium';reasons.push('Long distance or duration suggests a long run.')}
 else if(ratio!==null&&ratio>=.91&&valid.length>=3&&spread<.1){type='tempo';confidence='Medium';reasons.push('Sustained higher HR with relatively steady lap pace suggests tempo.')}
 else if(ratio!==null&&ratio<.79){type=ratio<.68?'recovery':'easy';confidence='Low';reasons.push('Average HR is low relative to LTHR; purpose cannot be confirmed.')}
 else reasons.push('No strong workout-type signal; avoid guessing from average pace alone.');
 if(pattern!=='insufficient lap data')reasons.push('Observed pacing pattern: '+pattern+'.');
 else reasons.push('At least 3 meaningful laps are needed to identify a pacing pattern.');
 if(ratio!==null)reasons.push('Average HR: '+Math.round(ratio*100)+'% of LTHR ('+lthr+' bpm).');
 if(named&&valid.length>=3&&type==='easy'&&ratio!==null&&ratio>=.91)reasons.push('Caution: recorded HR is high for an easy-labeled workout.');
 return {type,pattern,confidence,reasons,hasNameCue:!!named};
}
