// Minimal FIT session reader. Supports standard and compressed record headers.
type Field={num:number;size:number;base:number};
type Def={global:number;little:boolean;fields:Field[];devSize:number};
const EPOCH=631065600000;
export function parseFit(buffer:ArrayBuffer){
 const v=new DataView(buffer);const b=new Uint8Array(buffer);
 if(b.length<16)throw Error('FIT file too short');
 const header=b[0],dataSize=v.getUint32(4,true),end=header+dataSize;
 if(header<12||end+2>b.length||String.fromCharCode(...b.slice(8,12))!=='.FIT')throw Error('Invalid FIT header');
 const defs=new Map<number,Def>();let p=header;let session:Record<number,number>={};
 function numberAt(offset:number,size:number,base:number,little:boolean):number|undefined{
  const t=base&31;if(size===0)return undefined;
  if(size===1){const n=b[offset];return n===255?undefined:n}
  if(size===2){const n=(t===0x83)?v.getInt16(offset,little):v.getUint16(offset,little);return n===65535||n===32767?undefined:n}
  if(size===4){const n=t===0x85?v.getFloat32(offset,little):t===0x86?v.getFloat64(offset,little):t===0x85?0:v.getUint32(offset,little);return n===4294967295?undefined:n}
  return undefined;
 }
 while(p<end){
  const h=b[p++];const compressed=(h&0x80)!==0;const local=compressed?(h>>5)&3:h&15;
  if(!compressed&&(h&0x40)){
   if(p+5>end)throw Error('Truncated FIT definition');
   p++;const little=b[p++]===0;const global=v.getUint16(p,little);p+=2;const count=b[p++];const fields:Field[]=[];
   for(let i=0;i<count;i++){if(p+3>end)throw Error('Truncated fields');fields.push({num:b[p],size:b[p+1],base:b[p+2]});p+=3}
   let devSize=0;if(h&0x20){if(p>=end)throw Error('Truncated developer fields');const countDev=b[p++];devSize=countDev*3;if(p+devSize>end)throw Error('Truncated developer fields');p+=devSize}
   defs.set(local,{global,little,fields,devSize});continue;
  }
  const d=defs.get(local);if(!d)throw Error('Missing FIT definition');
  const vals:Record<number,number>={};
  for(const f of d.fields){if(p+f.size>end)throw Error('Truncated FIT data');if(d.global===18){const n=numberAt(p,f.size,f.base,d.little);if(n!==undefined)vals[f.num]=n}p+=f.size}
  if(p+d.devSize>end)throw Error('Truncated developer data');p+=d.devSize;
  if(d.global===18)session=vals;
 }
 const distance=(session[9]??0)/100, duration=Math.round((session[8]??session[7]??0)/1000);
 const timestamp=session[2]??session[253];
 if(distance<=0||duration<=0||timestamp===undefined)throw Error('No valid session distance, duration or start time in FIT');
 return {distance_m:distance,duration_s:duration,started_at:new Date(EPOCH+timestamp*1000).toISOString(),avg_hr:session[16]??null,elevation_gain_m:session[22]??null};
}
