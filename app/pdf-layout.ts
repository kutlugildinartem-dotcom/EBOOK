import {looksLikeHeading, type Publication} from './book-model';
export type PdfLine={x:number;y:number;end:number;height:number;text:string};
export type PdfPage={height:number;lines:PdfLine[]};
/** Reconstruct physical lines from coordinates, even if PDF items arrive out of order. */
export function pdfLines(items:any[]):PdfLine[]{
 const result:PdfLine[]=[];
 for(const item of items){if(typeof item.str!=='string'||!item.str.trim()||!item.transform)continue;const x=item.transform[4],y=item.transform[5],height=Math.abs(item.height)||Math.hypot(item.transform[2],item.transform[3])||12;
  let line=result.find(l=>Math.abs(l.y-y)<Math.max(l.height,height)*.3);
  if(!line){line={x,y,end:x,height,text:''};result.push(line);}(line as PdfLine&{parts?:any[]}).parts??=[];(line as any).parts.push({x,width:item.width||0,text:item.str,height});line.height=Math.max(line.height,height);
 }
 for(const line of result){const parts=(line as any).parts.sort((a:any,b:any)=>a.x-b.x);line.x=parts[0].x;line.end=parts[0].x;for(const part of parts){const gap=part.x-line.end;line.text+=(line.text&&gap>line.height*.12&&!line.text.endsWith(' ')?' ':'')+part.text;line.x=Math.min(line.x,part.x);line.end=Math.max(line.end,part.x+part.width);}delete(line as any).parts;}
 return result.sort((a,b)=>b.y-a.y||a.x-b.x);
}
export function pdfTextBlocks(pages:PdfPage[]){
 const weights=new Map<number,number>();for(const page of pages)for(const line of page.lines){const key=Math.round(line.height*2)/2;weights.set(key,(weights.get(key)||0)+line.text.length);}const body=[...weights].sort((a,b)=>b[1]-a[1])[0]?.[0]||12;
 const signature=(text:string)=>text.toLowerCase().replace(/\d+/g,'#').replace(/\s+/g,' ').trim();
 const margin=(page:PdfPage,line:PdfLine)=>line.y>page.height*.9?'top':line.y<page.height*.1?'bottom':'';
 const repeated=new Map<string,Set<number>>();pages.forEach((page,index)=>{for(const line of page.lines){const edge=margin(page,line);if(!edge||line.height>body*1.1||line.text.length>140)continue;const key=edge+':'+signature(line.text);if(!repeated.has(key))repeated.set(key,new Set());repeated.get(key)!.add(index);}});
 const blocks:{kind:'paragraph'|'heading';text:string;level?:number}[]=[];let paragraph='';
 const flush=()=>{if(paragraph.trim())blocks.push({kind:'paragraph',text:paragraph.trim()});paragraph='';};
 for(const page of pages){const lines=page.lines.filter(line=>{const edge=margin(page,line);if(!edge)return true;if(/^(?:page\s*)?\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(line.text.trim()))return false;const occurrences=repeated.get(edge+':'+signature(line.text))?.size||0;return !(pages.length>=3&&occurrences>=Math.max(2,Math.ceil(pages.length*.35))&&line.height<=body*1.1);});
  const gaps=lines.slice(1).map((l,i)=>lines[i].y-l.y).filter(x=>x>body*.7&&x<body*2).sort((a,b)=>a-b),normalGap=gaps[Math.floor(gaps.length/2)]||body*1.25;let previous:PdfLine|undefined;
  for(const line of lines){const text=line.text.trim(),heading=looksLikeHeading(text)||(line.height>body*1.25&&text.length<160);
   if(heading){flush();blocks.push({kind:'heading',text,level:1});}
   else{const gap=previous?previous.y-line.y:0,indent=previous?line.x-previous.x:0;if(previous&&(gap>normalGap*1.5||indent>body*1.25&&/[.!?][”"']?$/.test(paragraph)))flush();if(paragraph.endsWith('\u00ad'))paragraph=paragraph.slice(0,-1);else if(paragraph&&!paragraph.endsWith('-'))paragraph+=' ';paragraph+=text;}
   previous=line;
  }
 }flush();return blocks;
}
