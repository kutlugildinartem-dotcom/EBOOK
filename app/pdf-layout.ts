import {looksLikeHeading} from './book-model';
export type PdfLine={x:number;y:number;end:number;height:number;text:string;angle?:number};
export type PdfPage={height:number;width?:number;lines:PdfLine[]};
/** Group by baseline and orientation so a vertical margin title never joins body text. */
export function pdfLines(items:any[]):PdfLine[]{
 const groups:{cross:number;angle:number;height:number;parts:{along:number;x:number;y:number;width:number;text:string}[]}[]=[];
 for(const item of items){if(typeof item.str!=='string'||!item.str.trim()||!item.transform)continue;const [a,b,c,d,x,y]=item.transform,height=Math.hypot(a,b)||Math.hypot(c,d)||Math.abs(item.height)||12,angle=Math.atan2(b,a),cos=Math.cos(angle),sin=Math.sin(angle),cross=-x*sin+y*cos,along=x*cos+y*sin;
  let group=groups.find(g=>Math.abs(g.angle-angle)<.08&&Math.abs(g.cross-cross)<Math.max(g.height,height)*.3);if(!group){group={cross,angle,height,parts:[]};groups.push(group);}group.parts.push({along,x,y,width:item.width||0,text:item.str});group.height=Math.max(group.height,height);
 }
 return groups.map(group=>{const parts=group.parts.sort((a,b)=>a.along-b.along),vertical=Math.abs(Math.sin(group.angle))>.7;let text='',end=parts[0].along;for(const part of parts){const gap=part.along-end;text+=(text&&gap>group.height*.12&&!text.endsWith(' ')?' ':'')+part.text;end=Math.max(end,part.along+part.width);}return{x:Math.min(...parts.map(p=>p.x)),y:Math.max(...parts.map(p=>p.y)),end:vertical?Math.max(...parts.map(p=>p.x)):Math.max(...parts.map(p=>p.x+p.width)),height:group.height,text,angle:group.angle};}).sort((a,b)=>b.y-a.y||a.x-b.x);
}
const signature=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/\d+/g,'#').replace(/[\s\u00ad]+/g,' ').trim();
/** Detect repeated matter at consistent page positions, including alternating pages and side margins. */
export function stripPdfRunningMatter(pages:PdfPage[],meta:{title?:string;author?:string}={}){
 const horizontal=(line:PdfLine)=>Math.abs(Math.sin(line.angle||0))<.7;
 const weights=new Map<number,number>();for(const page of pages)for(const line of page.lines)if(horizontal(line)){const key=Math.round(line.height*2)/2;weights.set(key,(weights.get(key)||0)+line.text.length);}const body=[...weights].sort((a,b)=>b[1]-a[1])[0]?.[0]||12;
 const known=new Set([meta.title,meta.author].filter(Boolean).map(value=>signature(value!)));
 type Sample={page:number;index:number;position:number;line:PdfLine;edge:string};const candidates=new Map<string,Sample[]>();
 const edgeFor=(page:PdfPage,line:PdfLine,index:number)=>{
  const vertical=!horizontal(line),width=page.width||Math.max(1,...page.lines.map(l=>l.end))+30;
  if(vertical&&line.x<width*.2)return'left';if(vertical&&line.x>width*.8)return'right';
  const long=page.lines.filter(l=>horizontal(l)&&l.text.length>=35&&l.height<=body*1.2),left=long.length?Math.min(...long.map(l=>l.x)):width*.15,right=long.length?Math.max(...long.map(l=>l.end)):width*.85;
  if(line.end<left-body*.6)return'left';if(line.x>right+body*.6)return'right';
  if(line.y>=page.height*.8&&index<3)return'top';if(line.y<=page.height*.2&&index>=page.lines.length-3)return'bottom';return'';
 };
 pages.forEach((page,pn)=>page.lines.forEach((line,index)=>{const edge=edgeFor(page,line,index),key=signature(line.text);if(!edge||line.text.length>180||!line.text.trim())return;if(/[!?][”"']?$/.test(line.text)||(/\.$/.test(line.text)&&!known.has(key)&&!/^\s*(?:\d+|[IVXLCDM]+)\.?\s*$/.test(line.text)))return;
  if(line.height>body*1.7||(line.height>body*1.45&&!known.has(key)))return;const position=(edge==='left'||edge==='right')?line.x/(page.width||Math.max(1,...page.lines.map(l=>l.end))+30):line.y/page.height;const bucket=edge+':'+key;if(!candidates.has(bucket))candidates.set(bucket,[]);candidates.get(bucket)!.push({page:pn,index,position,line,edge});
 }));
 const remove=new Set<string>();
 for(const samples of candidates.values())for(const sample of samples){const aligned=samples.filter(s=>Math.abs(s.position-sample.position)<.035),unique=[...new Set(aligned.map(s=>s.page))].sort((a,b)=>a-b),required=pages.length>=5?3:2;if(unique.length<required)continue;
  // A running chapter title may occur only within one chapter; global frequency is insufficient.
  const span=unique[unique.length-1]-unique[0]+1,density=unique.length/span,consecutive=unique.some((p,i)=>i>=required-1&&p-unique[i-required+1]<=2*(required-1));
  if(pages.length<3||(!consecutive&&density<.35))continue;for(const s of aligned)remove.add(s.page+':'+s.index);
 }
 const cleaned=pages.map((page,pn)=>({...page,lines:page.lines.filter((line,index)=>{const edge=edgeFor(page,line,index);if(edge&&/^(?:page\s*)?\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(line.text.trim()))return false;if(edge==='bottom'&&/^[IVXLCDM]+\.?$/.test(line.text.trim()))return false;return !remove.has(pn+':'+index);})}));
 return{pages:cleaned,body};
}
export function pdfTextBlocks(input:PdfPage[],meta:{title?:string;author?:string}={}){
 const {pages,body}=stripPdfRunningMatter(input,meta),blocks:{kind:'paragraph'|'heading';text:string;level?:number}[]=[];let paragraph='';const flush=()=>{if(paragraph.trim())blocks.push({kind:'paragraph',text:paragraph.trim()});paragraph='';};
 for(const page of pages){const lines=page.lines,gaps=lines.slice(1).map((l,i)=>lines[i].y-l.y).filter(x=>x>body*.7&&x<body*2).sort((a,b)=>a-b),normalGap=gaps[Math.floor(gaps.length/2)]||body*1.25;let previous:PdfLine|undefined;
  for(const line of lines){const text=line.text.trim(),heading=looksLikeHeading(text)||(line.height>body*1.25&&text.length<160);
   if(heading){flush();blocks.push({kind:'heading',text,level:1});}else{const gap=previous?previous.y-line.y:0,indent=previous?line.x-previous.x:0;if(previous&&(gap>normalGap*1.5||indent>body*1.25&&/[.!?][”"']?$/.test(paragraph)))flush();if(paragraph.endsWith('\u00ad'))paragraph=paragraph.slice(0,-1);else if(paragraph&&!paragraph.endsWith('-'))paragraph+=' ';paragraph+=text;}previous=line;
  }
 }flush();return blocks;
}
