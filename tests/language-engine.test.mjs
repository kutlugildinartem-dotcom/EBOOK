import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source=await fs.readFile('app/language-engine.ts','utf8');
const lexicon=await fs.readFile('app/lexicon.generated.json','utf8');
const js=ts.transpileModule(source.replace('import lexicon from "./lexicon.generated.json";',`const lexicon=${lexicon};`),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const engine=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
let requests=0;globalThis.fetch=async path=>{requests++;return new Response(await fs.readFile('public'+path));};
await engine.preloadDictionary();
assert.equal(requests,1,'The whole lookup index must load in one compressed request');
const cases=[['She is reading a book.','Present Continuous'],['She was reading.','Past Continuous'],['She has read the book.','Present Perfect'],['She had never seen it.','Past Perfect'],['She has been reading.','Present Perfect Continuous'],['She had been reading.','Past Perfect Continuous'],['She will read it.','Future Simple / will'],['She will be reading.','Future Continuous'],['She will have read it.','Future Perfect'],['She will have been reading.','Future Perfect Continuous'],['The book has been written.','Present Perfect Passive'],['The book will have been written.','Future Perfect Passive'],['She reads every day.','Вероятный Present Simple'],['She walked home.','Прошедшая форма / причастие'],['without waiting','Герундий после предлога'],['there is a book','Оборот there is / there are'],["She didn't go.",'Past Simple с did']];
for(const [text,title]of cases){const rules=engine.grammar(text);assert(rules.some(r=>r.title===title),`${text}: expected ${title}; got ${rules.map(r=>r.title)}`);for(const r of rules)assert.equal(text.slice(r.start,r.end),r.quote,'Rule offsets must refer to original text');}
assert(!engine.grammar('She ought to have wondered.').some(r=>r.title==='Present Perfect'));
assert(!engine.grammar('She could not have known.').some(r=>r.title==='Present Perfect'));
assert(engine.grammar('She ought to have wondered.').some(r=>r.id==='perfect-infinitive'));
assert(!engine.grammar('There was nothing to do.').some(r=>r.title==='Форма на -ing'||r.title==='Present Simple с do / does'));
assert(!engine.grammar('She has a book.').some(r=>r.title==='Present Perfect'));
assert(!engine.grammar('She has no pictures.').some(r=>r.title==='Present Perfect'));
for(const [form,base]of [['running','run'],['stopped','stop'],['studies','study'],['children','child'],['went','go'],['having','have']])assert(engine.candidates(form).includes(base),form);
const river=await engine.lookupWord('bank','We sat on the bank of the river.',14);assert(river.translation.includes('берег'),JSON.stringify(river));
const aliceBank=await engine.lookupWord('bank','Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.',70);assert(aliceBank.translation.includes('берег'),JSON.stringify(aliceBank));
const finance=await engine.lookupWord('bank','She deposited her money at the bank.',30);assert(finance.translation.includes('банк'),JSON.stringify(finance));
const phrase=await engine.lookupWord('looked','She looked up the word in a dictionary.',4);assert.equal(phrase.lemma,'look up');
const separated=await engine.lookupWord('up','She looked it up in a dictionary.',14);assert.equal(separated.lemma,'look up');
const possessive=await engine.lookupWord("John's","John's book is here.",0);assert(possessive.uncertain);
const word=await engine.lookupWord('reading','She was reading a book.',8);assert.equal(word.lemma,'read');assert(word.translation.includes('читать'));
const unknown=await engine.lookupWord('xyzqwerty','xyzqwerty',0);assert.equal(unknown.translation,'Слово не найдено');
assert(engine.sentenceAt('One sentence. Another one!',17).text==='Another one!');
console.log(`${cases.length} grammar cases, offsets, 6 inflections, 8 dictionary/context checks and sentence extraction passed.`);
const storageSource=await fs.readFile('app/storage.ts','utf8');
const storageJs=ts.transpileModule(storageSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const storage=await import('data:text/javascript;base64,'+Buffer.from(storageJs).toString('base64'));
globalThis.document={createElement:()=>({getContext:()=>({font:'',measureText:s=>({width:s.length*9.7})})})};
for(const text of ['A word.\n\nNext paragraph! '.repeat(200),'LongWord'.repeat(300),'One\nline\n\n\nNext line. '.repeat(200)])for(const width of [200,500]){const pages=storage.layoutPages(text,width,450,21,true);assert.equal(pages.map(p=>text.slice(p.start,p.end)).join(''),text,'Pagination must preserve all source characters');for(let i=0;i<pages.length;i++){assert(pages[i].end>pages[i].start);assert.equal(storage.positionPage(pages,pages[i].start),i);if(i)assert.equal(pages[i-1].end,pages[i].start);}}
console.log('Pagination preserves every character and position across 6 text/layout cases.');

const white=engine.lookupInstant('White','A White Rabbit ran past her.',2);assert.equal(white.translation,'белый');assert(!white.translation.includes('белок'));
assert.equal(engine.lookupInstant('white','Separate the egg white from the yolk.',17).translation,'белок яйца');
const phraseSelection=engine.translateSelectionReady('White Rabbit');assert(/белый кролик/i.test(phraseSelection.translation),JSON.stringify(phraseSelection));
assert(/красивая книга/i.test(engine.translateSelectionReady('beautiful book').translation));
const pageTranslation=engine.translatePassageReady('A White Rabbit ran past her. She read a beautiful book.');assert(/белый кролик/i.test(pageTranslation.text));assert(pageTranslation.segments.length>5);
const timings=[];for(let i=0;i<1000;i++){const begin=performance.now();engine.lookupInstant(i%2?'beautiful':'reading','She was reading a beautiful book.',i%2?18:8);timings.push(performance.now()-begin);}timings.sort((a,b)=>a-b);
assert.equal(requests,1,'No network requests may happen during word, phrase or page lookup after initialization');
console.log('White regression, egg-white context, phrase/page translation and zero-request lookup passed.');console.log(`Hot lookup: median ${timings[500].toFixed(3)} ms, p95 ${timings[950].toFixed(3)} ms.`);

const narrative=engine.translatePassageReady('She has been reading a beautiful book beside the river. We sat on the bank of the river and talked about our plans. John wrote a letter yesterday. If I knew the answer, I would tell you. She looked it up in a dictionary. They had already finished their work before we arrived.');
assert(!/Евангелие|вот это/i.test(narrative.text),narrative.text);
assert(/Джон написал/.test(narrative.text),narrative.text);assert(/искала это/.test(narrative.text),narrative.text);assert(/красивую книгу/.test(narrative.text),narrative.text);
console.log('Narrative regressions passed:',narrative.text);
// Contracted auxiliary forms and sentence-boundary regressions.
for(const [text,title]of [["I'm reading a book.",'Present Continuous'],["She's written a book.",'Present Perfect'],["They've been waiting.",'Present Perfect Continuous'],["I'd already finished.",'Past Perfect'],["We'll be reading.",'Future Continuous']])assert(engine.grammar(text).some(r=>r.title===title),text+' '+JSON.stringify(engine.grammar(text).map(r=>r.title)));
assert(!engine.grammar('She was. Reading helps.').some(r=>r.title==='Past Continuous'));
assert(engine.lookupInstant('rabbit-hole','a rabbit-hole',2).translation!=='Слово не найдено');
const modelSource=await fs.readFile('app/book-model.ts','utf8');
const modelJs=ts.transpileModule(modelSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const model=await import('data:text/javascript;base64,'+Buffer.from(modelJs).toString('base64'));
const bookModel=model.publicationFromText('CHAPTER I\nThe Beginning\n\nThis is a soft\nwrapped paragraph.\n\nThis is another paragraph.\n\nCHAPTER II\n\nA New Morning\n\n'+('A short word fills the line naturally. '.repeat(150)));
assert(bookModel.blocks.some(b=>b.kind==='heading'&&b.text==='CHAPTER I'));
assert(bookModel.blocks.some(b=>b.kind==='heading'&&b.text==='The Beginning'));
assert(bookModel.blocks.some(b=>b.text==='This is a soft wrapped paragraph.'));
for(const block of bookModel.blocks)assert.equal(bookModel.text.slice(block.start,block.end),block.text);
const layoutSource=await fs.readFile('app/reader-layout.ts','utf8');
const layoutJs=ts.transpileModule(layoutSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const paginator=await import('data:text/javascript;base64,'+Buffer.from(layoutJs).toString('base64'));
for(const width of [280,700]){const pages=await paginator.paginateBook(bookModel.blocks,bookModel.text,{width,height:570,fontSize:21,fontFamily:'Georgia'});assert.equal(pages.map(p=>bookModel.text.slice(p.start,p.end)).join(''),bookModel.text);for(const page of pages)for(const fragment of page.fragments){assert(fragment.end>fragment.start);assert(fragment.start>=bookModel.blocks[fragment.block].start);assert(fragment.end<=bookModel.blocks[fragment.block].end);if(fragment.start>bookModel.blocks[fragment.block].start)assert(/\s/.test(bookModel.text[fragment.start-1]));}assert(pages.some(p=>p.fragments.some(f=>bookModel.blocks[f.block].kind==='heading')));}
console.log('Chapter/paragraph preservation, word-boundary layout, contractions and sentence boundaries passed.');

assert.equal(engine.lookupInstant('I','Chapter I',8).translation,'I');
assert.equal(engine.lookupInstant('rabbit-hole','Down the Rabbit-Hole',9).translation,'кроличья нора');
assert.equal(engine.lookupInstant('made','The hot day made her feel sleepy.',12).pos,'v');
assert(!engine.translatePassageReady('The hot day made her feel sleepy.').text.includes('марка'));
console.log('Chapter numerals, compound meanings and inflected verb disambiguation passed.');

const fullShard=JSON.parse(await fs.readFile('public/dictionary/r.json','utf8'));const allRun=engine.allMeaningsReady('run').flatMap(m=>m.translations);for(const value of fullShard.run.flatMap(entry=>entry.s.flatMap(s=>s.t)))assert(allRun.includes(value),'Missing full dictionary meaning: '+value);console.log('All run senses from the unabridged dictionary are immediately available: '+allRun.length);
