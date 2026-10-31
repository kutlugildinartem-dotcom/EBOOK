export type TextBlock={kind:'paragraph'|'heading';text:string;start:number;end:number;level?:number};
export type Book={id:string;title:string;author:string;text:string;blocks?:TextBlock[];position:number;page?:number;demo?:boolean;added?:number;cover?:string;coverColor?:string};
export type Publication={title?:string;author?:string;text:string;blocks:TextBlock[];cover?:string};
export type PageFragment={block:number;start:number;end:number;continued:boolean};
export type ReaderPage={start:number;end:number;fragments:PageFragment[];chapter:string};
export const FONTS=[{id:'book',label:'Georgia',family:'Georgia, "Times New Roman", serif'},{id:'times',label:'Times',family:'"Times New Roman", Times, serif'},{id:'sans',label:'Arial',family:'Arial, Helvetica, sans-serif'},{id:'humanist',label:'Verdana',family:'Verdana, Geneva, sans-serif'},{id:'mono',label:'Моно',family:'"Courier New", monospace'}];
export function publicationFromBlocks(input:{kind:TextBlock['kind'];text:string;level?:number}[],meta:Omit<Publication,'text'|'blocks'>={}):Publication{
 let text='';const blocks:TextBlock[]=[];
 for(const block of input){const value=block.text.replace(/[\t\u00a0 ]+/g,' ').replace(/ *\n */g,' ').trim();if(!value)continue;if(text)text+='\n\n';const start=text.length;text+=value;blocks.push({...block,text:value,start,end:text.length});}return{...meta,text,blocks};
}
export function looksLikeHeading(line:string){const words=line.trim().split(/\s+/);const titleCase=line.length<95&&words.length>=2&&words.length<=12&&!/[.!?]$/.test(line)&&words.every(w=>/^[A-ZА-ЯЁ]/.test(w)||/^(?:a|an|the|of|in|on|and|or|to|for|with|by|from|into|upon|as|at)$/i.test(w));return titleCase||/^(?:chapter|part|book|section|prologue|epilogue|introduction|contents|глава|часть|предисловие|эпилог)\b.{0,100}$/i.test(line.trim())||/^(?:[IVXLCDM]{1,8}|\d{1,3})[.\s—–-]+[A-ZА-Я][^.!?]{2,75}$/.test(line.trim());}
export function publicationFromText(raw:string,meta:Omit<Publication,'text'|'blocks'>={}):Publication{
 const groups=raw.replace(/\r\n?/g,'\n').trim().split(/\n[ \t]*\n+/);const blocks:{kind:TextBlock['kind'];text:string;level?:number}[]=[];
 for(const group of groups){const lines=group.split('\n');let pending:string[]=[];const flush=()=>{if(pending.length){blocks.push({kind:'paragraph',text:pending.join(' ')});pending=[];}};for(const line of lines){if(looksLikeHeading(line)){flush();blocks.push({kind:'heading',text:line,level:1});}else pending.push(line);}flush();}return publicationFromBlocks(blocks,meta);
}
export function blocksFor(book:Book){return book.blocks?.length?book.blocks:publicationFromText(book.text).blocks;}
