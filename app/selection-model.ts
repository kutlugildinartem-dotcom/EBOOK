import type {TextBlock} from './book-model';
export type SelectionRange={start:number;end:number;kind:'word'|'sentence'|'paragraph'};
/** Translate boundary sentences in full rather than giving the engine half a clause. */
export function pageTranslationRange(text:string,block:TextBlock,fragment:{start:number;end:number}){
 const sentences=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter('en',{granularity:'sentence'}).segment(text.slice(block.start,block.end)),s=>({start:block.start+s.index,end:block.start+s.index+s.segment.length})):[];
 const first=sentences.find(s=>s.end>fragment.start),last=sentences.find(s=>s.end>=fragment.end);
 return trimRange(text,first?.start??block.start,last?.end??block.end);
}
function trimRange(text:string,start:number,end:number){while(start<end&&/\s/.test(text[start]))start++;while(end>start&&/\s/.test(text[end-1]))end--;return{start,end};}
export function holdSelection(text:string,blocks:TextBlock[],start:number,end:number,milliseconds:number):SelectionRange{
 if(milliseconds<1000)return{start,end,kind:'word'};const block=blocks.find(b=>start>=b.start&&start<b.end);if(!block)return{start,end,kind:'word'};if(milliseconds>=2000)return{...trimRange(text,block.start,block.end),kind:'paragraph'};
 const local=text.slice(block.start,block.end);if(typeof Intl.Segmenter==='function'){const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});for(const segment of segmenter.segment(local)){const a=block.start+segment.index,b=a+segment.segment.length;if(start>=a&&start<b)return{...trimRange(text,a,b),kind:'sentence'};}}
 let a=start,b=end;while(a>block.start&&!/[.!?]/.test(text[a-1]))a--;while(b<block.end&&!/[.!?]/.test(text[b]))b++;if(b<block.end)b++;return{...trimRange(text,a,b),kind:'sentence'};
}
