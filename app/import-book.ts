import {publicationFromBlocks,publicationFromText,looksLikeHeading,type Publication,type TextBlock} from './book-model';
import {pdfLines,pdfTextBlocks,type PdfPage} from './pdf-layout';
const blockTags=new Set(['BODY','MAIN','ARTICLE','SECTION','DIV','H1','H2','H3','H4','H5','H6','P','LI','UL','OL','BLOCKQUOTE','PRE','TABLE','TR','TD','TH','FIGCAPTION']);
function noise(node:Element){return ['HEAD','SCRIPT','STYLE','NAV','IFRAME','OBJECT','FORM'].includes(node.tagName.toUpperCase())||node.hasAttribute('hidden')||node.getAttribute('aria-hidden')==='true'||/(?:^|\s)(?:toc|landmarks|page-list)(?:\s|$)/.test(node.getAttribute('epub:type')||'')||node.getAttribute('role')==='doc-toc';}
function inlineText(node:Node):string{if(node.nodeType===3)return node.textContent||'';if(node.nodeType!==1)return'';const el=node as Element;if(noise(el))return'';if(el.tagName.toUpperCase()==='BR')return' ';return Array.from(el.childNodes).map(inlineText).join('');}
/** Use document structure. A title-cased line in a paragraph is still a paragraph. */
export function htmlBlocks(doc:Document){
 const blocks:{kind:TextBlock['kind'];text:string;level?:number}[]=[];
 function walk(el:Element){if(noise(el))return;const tag=el.tagName.toUpperCase();let pending='';
  const flush=()=>{const text=pending.replace(/\s+/g,' ').trim();pending='';if(!text)return;const explicit=/^H[1-6]$/.test(tag),heading=explicit||looksLikeHeading(text);blocks.push({kind:heading?'heading':'paragraph',text:tag==='LI'?'• '+text:text,level:heading?(explicit?Number(tag[1]):1):undefined});};
  for(const child of Array.from(el.childNodes)){if(child.nodeType===1&&blockTags.has((child as Element).tagName.toUpperCase())){flush();walk(child as Element);}else pending+=inlineText(child);}flush();
 }
 const root=doc.getElementsByTagName('body')[0]||doc.documentElement;if(root)walk(root);return blocks;
}
export function decodeBookText(buffer:ArrayBuffer){const bytes=new Uint8Array(buffer);let encoding='utf-8';
 if(bytes[0]===255&&bytes[1]===254)encoding='utf-16le';else if(bytes[0]===254&&bytes[1]===255)encoding='utf-16be';else{const sample=bytes.subarray(0,Math.min(bytes.length,400));let even=0,odd=0;for(let i=0;i<sample.length;i++)if(sample[i]===0){if(i%2)odd++;else even++;}if(odd>sample.length*.2)encoding='utf-16le';else if(even>sample.length*.2)encoding='utf-16be';}
 try{return new TextDecoder(encoding,{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}catch{const high=bytes.filter(x=>x>=0xc0).length;return new TextDecoder(high>bytes.length*.15?'windows-1251':'windows-1252').decode(bytes);}
}
const elements=(doc:Document|Element,name:string)=>Array.from(doc.getElementsByTagNameNS('*',name));
const binaryUrl=(bytes:Uint8Array,type:string)=>{let result='';for(let i=0;i<bytes.length;i+=16384)result+=String.fromCharCode(...bytes.subarray(i,i+16384));return 'data:'+type+';base64,'+btoa(result);};
export async function extractPublication(file:File):Promise<Publication>{
 const ext=file.name.split('.').pop()?.toLowerCase();let publication:Publication;
 if(ext==='txt'){const text=decodeBookText(await file.arrayBuffer()),header=text.slice(0,10000);const title=header.match(/^Title:\s*(.+)$/im)?.[1].trim(),author=header.match(/^Author:\s*(.+)$/im)?.[1].trim();publication=publicationFromText(text,{title,author});} else if(ext==='docx'){const mammoth=await import('mammoth');const result=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});const doc=new DOMParser().parseFromString(result.value,'text/html');publication=publicationFromBlocks(htmlBlocks(doc));}
 else if(ext==='epub'){
 const {unzipSync,strFromU8}=await import('fflate');const files=unzipSync(new Uint8Array(await file.arrayBuffer()));const xml=(s:string)=>new DOMParser().parseFromString(s,'application/xml');
 const container=files['META-INF/container.xml'];if(!container)throw new Error('Не удалось прочитать структуру EPUB.');const opfPath=elements(xml(strFromU8(container)),'rootfile')[0]?.getAttribute('full-path');if(!opfPath||!files[opfPath])throw new Error('EPUB повреждён или защищён.');const opf=xml(strFromU8(files[opfPath]));const base=opfPath.split('/').slice(0,-1).join('/');const resolve=(href:string,folder=base)=>decodeURIComponent(new URL((folder?folder+'/':'')+href,'https://book.local/').pathname.slice(1));
 const manifest=elements(opf,'item');const blocks:ReturnType<typeof htmlBlocks>=[];let cover:string|undefined;const coverId=elements(opf,'meta').find(x=>x.getAttribute('name')==='cover')?.getAttribute('content');const coverItem=manifest.find(x=>x.getAttribute('properties')?.split(/\s+/).includes('cover-image'))||manifest.find(x=>x.getAttribute('id')===coverId)||manifest.find(x=>/cover/i.test(x.getAttribute('id')||'')&&/^image\//.test(x.getAttribute('media-type')||''));
 if(coverItem){const href=coverItem.getAttribute('href'),mime=coverItem.getAttribute('media-type')||'';const data=href?files[resolve(href)]:null;if(data&&data.length<4*1024*1024&&/^image\/(jpeg|png|webp|gif)$/.test(mime))cover=binaryUrl(data,mime);}
 for(const ref of elements(opf,'itemref')){if(ref.getAttribute('linear')==='no')continue;const item=manifest.find(x=>x.getAttribute('id')===ref.getAttribute('idref'));if(item?.getAttribute('properties')?.split(/\s+/).includes('nav'))continue;const href=item?.getAttribute('href');if(!href)continue;const path=resolve(href),data=files[path];if(!data)continue;const doc=new DOMParser().parseFromString(strFromU8(data),'text/html');if(!cover&&/cover/i.test(href)){const src=doc.querySelector('img')?.getAttribute('src');if(src){const imagePath=resolve(src,path.split('/').slice(0,-1).join('/')),image=files[imagePath],mime=/\.png$/i.test(imagePath)?'image/png':/\.jpe?g$/i.test(imagePath)?'image/jpeg':'';if(image&&image.length<4*1024*1024&&mime)cover=binaryUrl(image,mime);}}
 const chapter=htmlBlocks(doc);if(chapter.length)blocks.push(...chapter);}
 const title=opf.getElementsByTagNameNS('*','title')[0]?.textContent?.trim(),author=opf.getElementsByTagNameNS('*','creator')[0]?.textContent?.trim();publication=publicationFromBlocks(blocks,{title,author,cover});
 }else if(ext==='pdf'){
 const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';const task=pdfjs.getDocument({data:await file.arrayBuffer()}),pdf=await task.promise,pages:PdfPage[]=[];let title:string|undefined,author:string|undefined;
 try{try{const metadata=await pdf.getMetadata(),info=metadata.info as {Title?:string;Author?:string};title=info.Title?.trim();author=info.Author?.trim();}catch{}
  for(let pn=1;pn<=pdf.numPages;pn++){const page=await pdf.getPage(pn),content=await page.getTextContent();pages.push({height:page.getViewport({scale:1}).height,lines:pdfLines(content.items)});page.cleanup();}
 }finally{await task.destroy();}publication=publicationFromBlocks(pdfTextBlocks(pages),{title,author});
 }else throw new Error('Выберите EPUB, PDF, DOCX или TXT.');
 if(!publication.text.trim())throw new Error(ext==='pdf'?'Не найден текстовый слой. PDF-скану сначала нужно распознавание (OCR).':'В файле не найден читаемый текст.');return{...publication,parserVersion:2,sourceFormat:ext};
}
export async function extractBook(file:File){return (await extractPublication(file)).text;}
