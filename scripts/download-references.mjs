import { chmod, mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DOCUMENTS } from '../web/data/documents.mjs';

const directory = process.argv[2] ?? 'references';
await mkdir(directory, { recursive: true });

async function isPdf(path) {
  let file;
  try {
    file = await open(path);
    const header = Buffer.alloc(5);
    const { bytesRead } = await file.read(header);
    return bytesRead === 5 && header.toString() === '%PDF-';
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  } finally {
    await file?.close();
  }
}

async function download(id, url) {
  const path = join(directory, id + '.pdf');
  if (await isPdf(path)) return;
  const response = await fetch(url, { signal: AbortSignal.timeout(35000) });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const pdf = Buffer.from(await response.arrayBuffer());
  if (pdf.subarray(0, 5).toString() !== '%PDF-' || !pdf.subarray(-2048).includes(Buffer.from('%%EOF'))) {
    throw new Error('a origem não retornou um PDF completo');
  }
  const temporaryPath = path + '.' + process.pid + '.part';
  try {
    await writeFile(temporaryPath, pdf, { mode: 0o644 });
    await chmod(temporaryPath, 0o644);
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

const entries = Object.entries(DOCUMENTS);
const results = await Promise.allSettled(entries.map(([id, url]) => download(id, url)));
for (const [index, result] of results.entries()) {
  const [id] = entries[index];
  if (result.status === 'fulfilled') console.log(id + ' disponível');
  else console.error(id + ': ' + result.reason.message);
}
if (results.some(result => result.status === 'rejected')) process.exitCode = 1;
