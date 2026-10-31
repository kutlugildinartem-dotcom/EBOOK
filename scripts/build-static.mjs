import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(root+'/package.json');
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}));
const dictionary=await fs.readFile(root+'/public/dictionary/fast-v4.json.gz');
const worker=await fs.readFile(root+'/public/translation-worker.js','utf8');
const result=await build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import Home from './app/page';createRoot(document.getElementById('root')).render(React.createElement(Home));",resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'standalone-assets',setup(b){
 b.onLoad({filter:/app\/language-engine\.ts$/},async args=>{let s=await fs.readFile(args.path,'utf8');s=s.replace("const DICTIONARY_URL='/dictionary/fast-v4.json.gz';",'const DICTIONARY_URL='+JSON.stringify('data:application/gzip;base64,'+dictionary.toString('base64'))+';');return{contents:s,loader:'ts',resolveDir:root+'/app'};});
 b.onLoad({filter:/app\/translation-service\.ts$/},async args=>{let s=await fs.readFile(args.path,'utf8');s=s.replace("export const googleServiceAvailable=()=>!localFile;","export const googleServiceAvailable=()=>false;").replace("if(!localFile&&localStorage.getItem('leaf-translation-mode-v2')==='google')","if(false)").replace("if(localFile&&value==='google')","if(value==='google')");s=s.replace("const WORKER_URL='/translation-worker.js';",()=> 'const WORKER_URL=URL.createObjectURL(new Blob(['+JSON.stringify(worker)+'],{type:"text/javascript"}));');s=s.replace("new URL('/translation-runtime/',location.href).href",JSON.stringify('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/'));return{contents:s,loader:'ts',resolveDir:root+'/app'};});
 b.onLoad({filter:/app\/import-book\.ts$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace("'/pdf.worker.min.mjs'",JSON.stringify('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.min.mjs')),loader:'ts',resolveDir:root+'/app'}));
}}]});
const css=await fs.readFile(root+'/app/globals.css','utf8');const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
await fs.mkdir(root+'/dist-static',{recursive:true});
await fs.writeFile(root+'/dist-static/index.html','<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Leaf — читать и понимать</title><style>'+css+'</style></head><body><div id="root"></div><script>'+script+'</script></body></html>');
new Function(result.outputFiles[0].text);console.log('Standalone HTML built; JavaScript syntax verified.');
