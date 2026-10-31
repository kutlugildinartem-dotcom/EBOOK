import type {Book} from './book-model';
export type {Book} from './book-model';
export async function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('leaf-reader-v2',1);r.onupgradeneeded=()=>{r.result.createObjectStore('books',{keyPath:'id'});r.result.createObjectStore('state');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function loadLibrary():Promise<Book[]|null>{const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(['books','state']),r=tx.objectStore('books').getAll(),state=tx.objectStore('state').get('library-initialized');tx.oncomplete=()=>resolve(r.result.length||state.result?r.result:null);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export async function storeBook(book:Book){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['books','state'],'readwrite');tx.objectStore('state').put(true,'library-initialized');tx.objectStore('books').put(book);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export async function deleteBook(id:string){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['books','state'],'readwrite');tx.objectStore('state').put(true,'library-initialized');tx.objectStore('books').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export type TextPage={start:number;end:number};
export function positionPage(pages:TextPage[],position:number){let lo=0,hi=pages.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(pages[m].start<=position)lo=m+1;else hi=m-1;}return Math.max(0,hi);}
/** Canvas measures words; two spare lines absorb browser font rounding. Ranges preserve every character. */
export function layoutPages(text:string,width:number,height:number,fontSize:number,serif:boolean):TextPage[]{
 if(typeof document==='undefined'||width<80||height<100)return[{start:0,end:Math.min(text.length,900)}];
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)return[{start:0,end:text.length}];
 ctx.font=`${fontSize}px ${serif?'Georgia, "Times New Roman", serif':'Arial, sans-serif'}`;
 const lineHeight=fontSize*1.85,maxLines=Math.max(2,Math.floor(height/lineHeight)-1);let line=1,x=0,start=0;const pages:TextPage[]=[];const widths=new Map<string,number>();
 for(const m of text.matchAll(/\n|[^\S\n]+|[^\s]+/g)){
 const part=m[0],at=m.index!;if(part==='\n'){if(line+1>maxLines&&at>start){pages.push({start,end:at});start=at;line=1;x=0;}else{line++;x=0;}continue;}
 let w=widths.get(part);if(w===undefined){w=ctx.measureText(part).width;widths.set(part,w);}
 if(/^\s+$/.test(part)){x+=w;continue;}
 let needed=x>0&&x+w>width?1:0;if(w>width)needed+=Math.max(0,Math.ceil(w/width)-1);
 if(line+needed>maxLines&&at>start){pages.push({start,end:at});start=at;line=1;x=0;needed=w>width?Math.ceil(w/width)-1:0;}
 if(needed){line+=needed;x=w>width?w%width:w;}else x+=w;
 }
 if(start<text.length||!pages.length)pages.push({start,end:text.length});return pages;
}

export async function loadState<T>(key:string):Promise<T|undefined>{const db=await database();try{return await new Promise((resolve,reject)=>{const request=db.transaction('state').objectStore('state').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}}
export async function storeState(key:string,value:unknown){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
