import {atomic} from './files.mjs';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function report(root,data){
 await atomic(resolve(root,'report.json'),data);
 await writeFile(resolve(root,'report.html'),'<!doctype html><html lang="de"><meta charset="utf-8"><title>Lokaler KI-Versuch</title><style>body{font:16px system-ui;margin:2rem;max-width:1000px}pre{white-space:pre-wrap;overflow-wrap:anywhere}strong{color:#744}</style><h1>Lokaler KI-Versuch</h1><p><strong>'+escape(data.status)+'</strong></p><p>Feuerzielbewertung, keine automatische Modellübernahme. Technische Limits sind keine Unentschieden. Rechenzeit ist keine Browseranimationsmessung.</p><pre>'+escape(JSON.stringify(data,null,2))+'</pre></html>');
}
