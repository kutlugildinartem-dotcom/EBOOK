import fs from 'node:fs/promises';import assert from 'node:assert/strict';import ts from 'typescript';
async function load(file){const source=await fs.readFile(file,'utf8');return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));}
Error.stackTraceLimit=0;
const selection=await load('app/selection-model.ts'),online=await load('app/translation-service.ts');
const text='First sentence. Another sentence with words.\n\nA second paragraph. More text.',boundary=text.indexOf('\n\n'),blocks=[{kind:'paragraph',text:text.slice(0,boundary),start:0,end:boundary},{kind:'paragraph',text:text.slice(boundary+2),start:boundary+2,end:text.length}],start=text.indexOf('sentence with'),end=start+8;
assert.deepEqual(selection.holdSelection(text,blocks,start,end,999),{start,end,kind:'word'});
const sentence=selection.holdSelection(text,blocks,start,end,1000);assert.equal(text.slice(sentence.start,sentence.end),'Another sentence with words.');assert.equal(sentence.kind,'sentence');
const paragraph=selection.holdSelection(text,blocks,start,end,2000);assert.equal(text.slice(paragraph.start,paragraph.end),'First sentence. Another sentence with words.');assert.equal(paragraph.kind,'paragraph');
const unicode='Hello 😀, café! '.repeat(100);const chunks=online.splitTranslationText(unicode,480);assert.equal(chunks.join(''),unicode.trim());assert(chunks.every(c=>new TextEncoder().encode(c).length<=480));assert(chunks.every(c=>!/[\uD800-\uDBFF]$/.test(c)));
online.setTranslationMode('google');
let calls=0;globalThis.fetch=async (url,options)=>{calls++;assert.equal(url,'/api/translate');const q=JSON.parse(options.body).text;assert(new TextEncoder().encode(q).length<=4500);return new Response(JSON.stringify({text:'ПЕРЕВОД '+q}));};
const a=await online.translateOnline('A book.');assert.equal(a.text,'ПЕРЕВОД A book.');assert.equal(a.provider,'Google');const b=await online.translateOnline('A book.');assert.equal(b.cached,true);assert.equal(calls,1);
await Promise.all([online.translateOnline('Concurrent sentence.'),online.translateOnline('Concurrent sentence.')]);assert.equal(calls,2,'Identical concurrent requests must share one translation');
const long='A complete sentence. '.repeat(700)+'Tailmarker.';const translatedLong=await online.translateOnline(long);assert(translatedLong.text.includes('Tailmarker.'),'Long text must not be truncated by a total character cap');const before=calls;await online.translateOnline(long);assert.equal(calls,before);
globalThis.fetch=async()=>new Response(JSON.stringify({error:'Google временно отклонил запрос'}),{status:429});await assert.rejects(()=>online.translateOnline('Rate test.'),/временно/);
globalThis.fetch=async()=>new Response(JSON.stringify({text:'Повтор удался'}));assert.equal((await online.translateOnline('Rate test.')).text,'Повтор удался','Failures must not poison the cache');
const aborted=new AbortController();aborted.abort();await assert.rejects(()=>online.translateOnline('Cancelled request.',{signal:aborted.signal}),{name:'AbortError'});
let nativeCalls=0;globalThis.Translator={availability:async()=> 'available',create:async()=>({translate:async text=>{nativeCalls++;return 'ЛОКАЛЬНО '+text;}})};online.setTranslationMode('device');assert.equal((await online.translateOnline('A book.')).text,'ЛОКАЛЬНО A book.','Engine caches must remain separate');assert.equal(nativeCalls,1);assert.equal((await online.translateOnline('A book.')).cached,true);assert.equal(nativeCalls,1);
console.log('Hold selection at 1s/2s, UTF-8 chunking, Google parsing, cache separation, deduplication, long text, rate errors, retry, cancellation and native translation passed.');

assert.equal(online.refineDeviceTranslation('The egg white was in a bowl.','Яйцо белое было в миске.'),'Яичный белок был в миске.');
assert.equal(online.refineDeviceTranslation('The hot day made her feel sleepy.','В жаркий день она почувствовала сон.'),'В жаркий день она захотела спать.');
assert.equal(online.refineDeviceTranslation('She looked up the word in the dictionary.','Она посмотрела на слово в словаре.'),'Она искала слово в словаре.');
assert.equal(online.refineDeviceTranslation('A white rabbit.','Белый кролик.'),'Белый кролик.');
console.log('Verified egg-white, sleepy, dictionary phrasal-verb and colour regressions passed.');

const boundaryText='A first sentence. She put the kettle on and waited for the water to boil. A final sentence.';
const boundaryBlock={kind:'paragraph',text:boundaryText,start:0,end:boundaryText.length};
const range=selection.pageTranslationRange(boundaryText,boundaryBlock,{start:boundaryText.indexOf('kettle'),end:boundaryText.indexOf('water')});
assert.equal(boundaryText.slice(range.start,range.end),'She put the kettle on and waited for the water to boil.');
const coherent=online.translationSegments('She sat on the bank. It was beside a river.');
assert.equal(coherent.length,1,'Related short sentences should retain paragraph context');
const segmented=online.translationSegments(long);
assert.equal(segmented.map(s=>s.text).join(''),long.trim(),'Every source character must survive segmentation');
assert(segmented.every(s=>s.separator||new TextEncoder().encode(s.text).length<=1000));
await assert.rejects(()=>online.translateOnline('A book.',{signal:aborted.signal}),{name:'AbortError'});
console.log('Whole boundary sentences, paragraph context, model input bounds, full source preservation and cancellation of cached results passed.');
