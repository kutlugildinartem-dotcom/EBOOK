import type {Book,Publication,TextBlock} from './book-model';
export type RemovedRange={start:number;end:number};
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/\u00ad/g,'').replace(/^[\s\d—–-]+|[\s\d—–-]+$/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
/** For coordinate-less text, only repeated standalone copies of the known title are safe to remove. */
export function titleHeaderRanges(blocks:TextBlock[],title:string):RemovedRange[]{
 const key=normalize(title);if(key.length<10||key.split(' ').length<3)return[];const matches=blocks.map((b,index)=>({b,index})).filter(({b})=>normalize(b.text)===key);if(matches.length<3)return[];
 return matches.filter(({index},i)=>!(i===0&&index<4)).map(({b})=>({start:b.start,end:b.end}));
}
export function mapAfterRemoval(position:number,ranges:RemovedRange[]){let removed=0;for(const range of ranges){if(position<=range.start)break;removed+=Math.min(position,range.end)-range.start;if(position<range.end)break;}return Math.max(0,position-removed);}
function removeRanges(text:string,ranges:RemovedRange[]){let cursor=0,out='';for(const r of ranges){out+=text.slice(cursor,r.start);cursor=r.end;}return out+text.slice(cursor);}
function remapBlocks(blocks:TextBlock[],ranges:RemovedRange[]){return blocks.filter(b=>!ranges.some(r=>b.start>=r.start&&b.end<=r.end)).map(b=>({...b,start:mapAfterRemoval(b.start,ranges),end:mapAfterRemoval(b.end,ranges)}));}
export function cleanPlainTextHeaders(text:string,title:string){const lines=text.split(/\r?\n/),key=normalize(title);if(key.length<10||key.split(' ').length<3)return text;const matches=lines.map((line,index)=>normalize(line)===key?index:-1).filter(i=>i>=0);if(matches.length<3||matches[matches.length-1]-matches[0]<10)return text;const remove=new Set(matches.filter((index,i)=>!(i===0&&index<6)));return lines.filter((_,i)=>!remove.has(i)).join('\n');}
export function cleanPublicationHeaders(publication:Publication,fallbackTitle=''):Publication{
 const ranges=titleHeaderRanges(publication.blocks,publication.title||fallbackTitle);if(!ranges.length)return publication;return{...publication,text:removeRanges(publication.text,ranges),blocks:remapBlocks(publication.blocks,ranges)};
}
export function cleanStoredHeaders<T extends {id:string;start:number;end:number;source:string}>(book:Book,notes:T[]){
 if(book.headerCleanup)return{book,notes,changed:false};const ranges=titleHeaderRanges(book.blocks||[],book.title);if(!ranges.length)return{book,notes,changed:false};
 const text=removeRanges(book.text,ranges),cleaned:Book={...book,text,blocks:remapBlocks(book.blocks!,ranges),position:mapAfterRemoval(book.position||0,ranges),headerCleanup:{version:1,sourceText:book.text,sourceBlocks:book.blocks!,ranges,sourceAnnotations:notes}};
 const next=notes.flatMap(note=>{const start=mapAfterRemoval(note.start,ranges),end=mapAfterRemoval(note.end,ranges);if(end<=start)return[];return[{...note,start,end,id:book.id+':'+start+':'+end,source:text.slice(start,end)}];});return{book:cleaned,notes:next,changed:true};
}
