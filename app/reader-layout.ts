import type {TextBlock,ReaderPage,PageFragment} from './book-model';
export type PageMeasure={width:number;height:number;fontSize:number;fontFamily:string;lineHeight?:number};
/** Greedy word wrapping uses the exact reader font and never inserts line breaks into paragraphs. */
export async function paginateBook(blocks:TextBlock[],text:string,spec:PageMeasure,cancelled:()=>boolean=()=>false):Promise<ReaderPage[]>{
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw new Error('Не удалось измерить текст.');
 const width=Math.max(80,spec.width),height=Math.max(75,spec.height-4),size=spec.fontSize,lineHeight=size*(spec.lineHeight||1.6);const cache=new Map<string,number>();
 const pages:ReaderPage[]=[];let fragments:PageFragment[]=[],used=0,chapter='';
 const push=()=>{if(!fragments.length)return;pages.push({start:fragments[0].start,end:fragments[fragments.length-1].end,fragments,chapter});fragments=[];used=0;};
 const measure=(word:string,heading:boolean)=>{const key=(heading?'h':'p')+word;let value=cache.get(key);if(value===undefined){ctx.font=`${heading?'500 ':''}${heading?size*1.3:size}px ${spec.fontFamily}`;value=ctx.measureText(word).width;cache.set(key,value);}return value;};
 for(let b=0;b<blocks.length;b++){
 if(cancelled())return[];if(b%60===59)await new Promise(resolve=>setTimeout(resolve,0));const block=blocks[b],heading=block.kind==='heading';const words=Array.from(block.text.matchAll(/\S+/g));if(!words.length)continue;
 const lh=heading?size*1.3*1.3:lineHeight,space=measure(' ',heading),after=heading?size*.65:size*.7;let wi=0;
 if(heading){const estimated=Math.max(1,Math.ceil(measure(block.text,true)/width));if(fragments.length&&used+size*.7+estimated*lh+lineHeight*2>height)push();chapter=block.text;}
 while(wi<words.length){
 const continued=wi>0;let gap=heading&&fragments.length?size*.7:0;let available=Math.floor((height-used-gap)/lh);if(available<1){push();gap=0;available=Math.max(1,Math.floor(height/lh));}
 const first=wi;let lines=1,x=heading||continued?0:size*.9;
 while(wi<words.length){const token=words[wi],ww=measure(token[0],heading);let extra=x>0&&x+ww>width?1:0;if(ww>width)extra+=Math.max(0,Math.ceil(ww/width)-1);if(lines+extra>available&&wi>first)break;if(lines+extra>available&&wi===first&&fragments.length)break;
 if(extra){lines+=extra;x=ww>width?ww%width:ww;}else x+=ww;x+=space;wi++;if(lines>available)break;}
 if(wi===first){push();continue;}const start=block.start+words[first].index!,last=words[wi-1],end=block.start+last.index!+last[0].length;fragments.push({block:b,start,end,continued});used+=gap+lines*lh+(wi===words.length?after:0);if(wi<words.length)push();
 }
 }
 push();for(let i=0;i<pages.length;i++){if(i===0)pages[i].start=0;pages[i].end=i+1<pages.length?pages[i+1].start:text.length;}return pages.length?pages:[{start:0,end:text.length,fragments:[],chapter:''}];
}
export function locatePage(pages:ReaderPage[],position:number){let lo=0,hi=pages.length-1;while(lo<=hi){const mid=(lo+hi)>>1;if(pages[mid].start<=position)lo=mid+1;else hi=mid-1;}return Math.max(0,hi);}
