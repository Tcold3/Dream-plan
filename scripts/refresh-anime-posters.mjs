import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import catalog from '../src/data/anime.json' with { type: 'json' };

const posterDir = path.resolve('public/posters');
const run = promisify(execFile);
let cursor = 0;
const failures = [];

async function dimensions(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', file]);
  const [width, height] = stdout.trim().split('x').map(Number);
  if (!width || !height) throw new Error(`Cannot read image dimensions: ${file}`);
  return { width, height };
}

async function downloadPoster(anime) {
  const destination = path.join(posterDir, `${anime.id}.jpg`);
  const temporary = `${destination}.source`;
  const converted = `${destination}.new.jpg`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const metadata = await fetch(`https://kitsu.io/api/edge/anime/${anime.id}`);
      if (!metadata.ok) throw new Error(`Metadata HTTP ${metadata.status}`);
      const url = (await metadata.json()).data?.attributes?.posterImage?.original;
      if (!url) throw new Error('Original poster URL missing');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
      const png = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      if (bytes.length < 10_000 || (!jpeg && !png)) throw new Error('Invalid poster image');
      await fs.writeFile(temporary, bytes);
      const original = await dimensions(temporary);
      const existing = await dimensions(destination);
      if (original.width * original.height <= existing.width * existing.height * 1.1) {
        console.log(`${anime.title}: kept ${existing.width}×${existing.height}`);
        await fs.unlink(temporary);
        return;
      }
      if (png || original.width > 1600) {
        const width = Math.min(1600, original.width);
        const height = Math.round(original.height * width / original.width / 2) * 2;
        await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', temporary, '-vf', `scale=${width}:${height}`, '-frames:v', '1', '-q:v', '3', converted]);
        await fs.rename(converted, destination);
        await fs.unlink(temporary);
      } else {
        await fs.rename(temporary, destination);
      }
      console.log(`${anime.title}: upgraded ${existing.width}×${existing.height} → ${original.width}×${original.height}`);
      return;
    } catch (error) {
      await fs.rm(temporary, { force: true });
      await fs.rm(converted, { force: true });
      if (attempt === 3) failures.push(`${anime.title}: ${error.message}`);
      else await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
}

async function worker() {
  while (cursor < catalog.length) {
    const anime = catalog[cursor++];
    await downloadPoster(anime);
  }
}

await Promise.all(Array.from({ length: 4 }, worker));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
