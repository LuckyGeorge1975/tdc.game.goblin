import {readFile} from 'node:fs/promises';
import {importIronDustTrainingArchive} from '../training-archive.mjs';

const [file]=process.argv.slice(2);
if(!file)throw Error('Usage: node scripts/import-training-archive.mjs <archive.json>');
const archive=JSON.parse(await readFile(file,'utf8'));
process.stdout.write(JSON.stringify(await importIronDustTrainingArchive(archive),null,2)+'\n');
