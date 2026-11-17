import {readFile} from 'node:fs/promises';
import {importIronDustTrainingArchive} from '../training-archive.mjs';

const [file]=process.argv.slice(2);
if(!file)throw Error('Usage: node scripts/import-training-archive.mjs <archive.json>');
const archive=JSON.parse(await readFile(file,'utf8'));
const imported=archive?.profile==='FULL_CATALOG_v1'?
  await (await import('./full-training-import.mjs')).importFullTrainingArchive(archive):
  await importIronDustTrainingArchive(archive);
process.stdout.write(JSON.stringify(imported,null,2)+'\n');
