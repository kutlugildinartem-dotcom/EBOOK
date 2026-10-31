export type TextBlock={kind:'paragraph'|'heading';text:string;start:number;end:number;level?:number};
export type Book={id:string;title:string;author:string;text:string;blocks?:TextBlock[];position:number;page?:number;demo?:boolean;added?:number;cover?:string;coverColor?:string;parserVersion?:number;sourceFormat?:string};
export type Publication={title?:string;author?:string;text:string;blocks:TextBlock[];cover?:string;parserVersion?:number;sourceFormat?:string};
export type PageFragment={block:number;start:number;end:number;continued:boolean};
export type ReaderPage={start:number;end:number;fragments:PageFragment[];chapter:string};
export const FONTS=[{id:'book',label:'Georgia',family:'Georgia, "Times New Roman", serif'},{id:'times',label:'Times',family:'"Times New Roman", Times, serif'},{id:'sans',label:'Arial',family:'Arial, Helvetica, sans-serif'},{id:'humanist',label:'Verdana',family:'Verdana, Geneva, sans-serif'},{id:'mono',label:'Моно',family:'"Courier New", monospace'}];
export function publicationFromBlocks(input:{kind:TextBlock['kind'];text:string;level?:number}[],meta:Omit<Publication,'text'|'blocks'>={}):Publication{
 let text='';const blocks:TextBlock[]=[];
 for(const block of input){const value=block.text.replace(/[\t\u00a0 ]+/g,' ').replace(/ *\n */g,' ').trim();if(!value)continue;if(text)text+='\n\n';const start=text.length;text+=value;blocks.push({...block,text:value,start,end:text.length});}return{...meta,text,blocks};
}
/** Only structural markers are guessed. Capitalization alone is never enough. */
export function looksLikeHeading(line:string){
 const value=line.trim();if(!value||value.length>120)return false;
 const number='(?:[ivxlcdm]+|\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|первая|вторая|третья|четвёртая|четвертая|пятая|шестая|седьмая|восьмая|девятая|десятая)';
 return new RegExp('^(?:chapter|part|book|section|volume|act|scene|глава|часть|книга|раздел|том)\\s+'+number+'(?:[.:]?$|\\s*[·:—–.-]\\s+[^.!?]{1,85}$)','i').test(value)||/^(?:prologue|epilogue|introduction|contents|preface|afterword|appendix|пролог|эпилог|предисловие|послесловие|оглавление|введение)[:.]?$/i.test(value)||/^[IVXLCDM]{1,10}\.?$/.test(value);
}
export function isChapterSubtitle(value:string){const words=value.trim().split(/\s+/);return value.length<=90&&words.length<=12&&!/[.!?;:][”"']?$/.test(value)&&words.every(w=>/^[A-ZА-ЯЁ0-9]/.test(w)||/^(?:a|an|the|of|in|on|and|or|to|for|with|by|from|into|upon|as|at)$/i.test(w));}
export function publicationFromText(raw:string,meta:Omit<Publication,'text'|'blocks'>={}):Publication{
 const groups=raw.replace(/\r\n?/g,'\n').replace(/^\uFEFF/,'').trim().split(/\n[ \t]*\n+/),blocks:{kind:TextBlock['kind'];text:string;level?:number}[]=[];
 for(const group of groups){const lines=group.split('\n');let pending:string[]=[];const flush=()=>{if(pending.length){blocks.push({kind:'paragraph',text:pending.join(' ')});pending=[];}};
  for(let i=0;i<lines.length;i++){const line=lines[i].trim();const previous=blocks[blocks.length-1];const subtitle=!pending.length&&previous?.kind==='heading'&&looksLikeHeading(previous.text)&&isChapterSubtitle(line)&&(i===lines.length-1||lines.length===2);
   if(looksLikeHeading(line)||subtitle){flush();blocks.push({kind:'heading',text:line,level:1});}else pending.push(line);
  }flush();
 }return publicationFromBlocks(blocks,meta);
}
/** Old heuristic headings can be repaired without changing any text/annotation offsets. */
export function repairLegacyBook(book:Book):Book{
 if(book.parserVersion===2)return book;const source=book.blocks?.length?book.blocks:publicationFromText(book.text).blocks;
 const blocks=source.map((block,index)=>{if(block.kind!=='heading')return block;const previous=source[index-1],title=index===0&&block.text.trim().toLowerCase()===book.title.trim().toLowerCase(),subtitle=previous?.kind==='heading'&&looksLikeHeading(previous.text)&&isChapterSubtitle(block.text);return title||looksLikeHeading(block.text)||subtitle?block:{...block,kind:'paragraph' as const,level:undefined};});
 return{...book,blocks,parserVersion:2};
}
export function blocksFor(book:Book){return book.blocks?.length?book.blocks:publicationFromText(book.text).blocks;}
