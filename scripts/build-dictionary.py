"""Convert FreeDict/WikDict TEI into browser-friendly shards. Dictionary: CC BY-SA 3.0."""
import json,re,unicodedata,tarfile,xml.etree.ElementTree as E
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'public/dictionary'
ns={'t':'http://www.tei-c.org/ns/1.0'};data={};lexicon={'verbs':set(),'adjectives':set()}
def clean(s):
 return unicodedata.normalize('NFC',re.sub(r'\[\[|\]\]','',s.replace('\u0301',''))).strip()
with tarfile.open(out/'source.tar.xz') as archive:
 tree=E.parse(archive.extractfile('eng-rus/eng-rus.tei'))
for entry in tree.findall('.//t:entry',ns):
 word=clean(entry.findtext('t:form/t:orth','',ns)).lower().replace('’',"'")
 if not word:continue
 pos=entry.findtext('t:gramGrp/t:pos','',ns)
 if word.isascii() and word.isalpha():
  if pos=='v':lexicon['verbs'].add(word)
  if pos=='adj':lexicon['adjectives'].add(word)
 senses=[]
 for s in entry.findall('t:sense',ns):
  translations=list(dict.fromkeys(clean(''.join(q.itertext())) for q in s.findall('t:cit[@type="trans"]/t:quote',ns)))
  defs=[clean(''.join(d.itertext())) for d in s.findall('.//t:def',ns)]
  if translations:senses.append({'t':translations,'d':' '.join(defs)})
 if not senses:continue
 data.setdefault(word,[]).append({'p':entry.findtext('t:gramGrp/t:pos','',ns),'ipa':entry.findtext('t:form/t:pron','',ns),'s':senses})
for key in 'abcdefghijklmnopqrstuvwxyz_':
 shard={w:v for w,v in data.items() if (w[0] if w[0] in 'abcdefghijklmnopqrstuvwxyz' else '_')==key}
 (out/(key+'.json')).write_text(json.dumps(shard,ensure_ascii=False,separators=(',',':')))
# Fast lookup index: translations, POS and sense-domain tags, no per-click shard requests.
fast={w:[[e['p'],[[sense['t'],' '.join(re.findall(r'\b(?:archaic|obsolete|dated|historical|informal|slang|vulgar|offensive|river|water|hydrology|money|financial|institution|banking|deposit|read|written|writing|book|text|computing|software|computer|digital|internet)\b',sense['d']))] for sense in e['s']]] for e in entries] for w,entries in data.items()}
packed=json.dumps(fast,ensure_ascii=False,separators=(',',':')).encode()
(out/'fast-v4.json').write_bytes(packed)
import gzip
(out/'fast-v4.json.gz').write_bytes(gzip.compress(packed,mtime=0))
meta={'entries':len(data),'version':'2025.11.23','source':'FreeDict / WikDict, Karl Bartel; Wiktionary contributors via DBnary','license':'CC BY-SA 3.0','sourceUrl':'https://download.freedict.org/dictionaries/eng-rus/2025.11.23/freedict-eng-rus-2025.11.23.src.tar.xz','changes':'TEI converted to JSON, accents and wiki markup normalized; entries grouped by initial letter. Fast v4 index retains every translation and sense per part of speech with compact domain tags, gzip-compressed for one-time loading.'}
(out/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
(root/'app/lexicon.generated.json').write_text(json.dumps({k:sorted(v) for k,v in lexicon.items()},separators=(',',':')))
print(meta)
