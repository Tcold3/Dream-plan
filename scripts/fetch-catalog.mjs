import fs from 'node:fs/promises';
import path from 'node:path';

const wanted = [
  ['70', 'Rumours', 'Fleetwood Mac', 1977],
  ['70', 'The Wall', 'Pink Floyd', 1979],
  ['70', 'Hotel California', 'Eagles', 1976],
  ['70', 'A Night at the Opera', 'Queen', 1975],
  ['70', 'Songs in the Key of Life', 'Stevie Wonder', 1976],
  ['80', 'Thriller', 'Michael Jackson', 1982],
  ['80', 'Purple Rain', 'Prince', 1984],
  ['80', 'Back In Black', 'AC/DC', 1980],
  ['80', 'Like a Virgin', 'Madonna', 1984],
  ['80', 'Born in the U.S.A.', 'Bruce Springsteen', 1984],
  ['90', 'Metallica', 'Metallica', 1991],
  ['90', 'The Bodyguard', 'Whitney Houston', 1992],
  ['90', 'Spice', 'Spice Girls', 1996],
  ['90', 'OK Computer', 'Radiohead', 1997],
  ['90', '...Baby One More Time', 'Britney Spears', 1999],
  ['00', 'Hybrid Theory', 'LINKIN PARK', 2000],
  ['00', 'Confessions', 'Usher', 2004],
  ['00', 'Back to Black', 'Amy Winehouse', 2006],
  ['00', 'The Fame', 'Lady Gaga', 2008],
  ['00', 'The Eminem Show', 'Eminem', 2002],
  ['10', '21', 'Adele', 2011],
  ['10', '1989', 'Taylor Swift', 2014],
  ['10', '25', 'Adele', 2015],
  ['10', 'DAMN.', 'Kendrick Lamar', 2017],
  ['10', 'thank u, next', 'Ariana Grande', 2019],
  ['20', 'SOUR', 'Olivia Rodrigo', 2021],
  ['20', 'Midnights', 'Taylor Swift', 2022],
  ['20', '30', 'Adele', 2021],
  ['20', 'SOS', 'SZA', 2022],
  ['20', 'HIT ME HARD AND SOFT', 'Billie Eilish', 2024],
  ['20', 'Short n’ Sweet', 'Sabrina Carpenter', 2024],
];

const clean = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function json(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response.json();
    await wait(500 * (attempt + 1));
  }
  throw new Error(`Failed: ${url}`);
}
const out = [];
await fs.mkdir('public/covers', { recursive: true });
for (const [era, title, artist, year] of wanted) {
  const q = new URLSearchParams({ term: `${title} ${artist}`, entity: 'album', limit: '15', country: 'US' });
  const search = await json(`https://itunes.apple.com/search?${q}`);
  const candidates = search.results.filter(item => clean(item.artistName).includes(clean(artist)) && clean(item.collectionName).startsWith(clean(title)));
  const album = candidates.sort((a, b) => Math.abs(new Date(a.releaseDate).getUTCFullYear() - year) - Math.abs(new Date(b.releaseDate).getUTCFullYear() - year))[0];
  if (!album) { console.warn('Missing album:', title, artist); continue; }
  const lookup = await json(`https://itunes.apple.com/lookup?id=${album.collectionId}&entity=song&country=US&limit=100`);
  const tracks = lookup.results.filter(item => item.wrapperType === 'track' && item.previewUrl).map(item => ({ title: item.trackName, preview: item.previewUrl, url: item.trackViewUrl }));
  if (!tracks.length) { console.warn('Missing previews:', title, artist); continue; }
  const id = `${era}-${clean(artist).slice(0, 16)}-${clean(title).slice(0, 18)}`;
  const imageUrl = album.artworkUrl100.replace(/\/100x100bb\.(jpg|png)$/, '/600x600bb.$1');
  const response = await fetch(imageUrl);
  if (!response.ok) { console.warn('Missing cover:', title); continue; }
  const extension = response.headers.get('content-type')?.includes('png') ? 'png' : 'jpg';
  const cover = `/covers/${id}.${extension}`;
  await fs.writeFile(path.join('public', cover), Buffer.from(await response.arrayBuffer()));
  out.push({ id, era, title, artist, year, cover, url: album.collectionViewUrl, tracks });
  console.log(`${era}s · ${title} · ${tracks.length} tracks`);
  await wait(130);
}
await fs.mkdir('src/data', { recursive: true });
await fs.writeFile('src/data/albums.json', JSON.stringify(out, null, 2));
console.log(`Saved ${out.length} albums`);
