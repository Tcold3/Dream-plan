import fs from 'node:fs/promises';
import path from 'node:path';

// The decade is the original TV anime premiere decade. Kitsu IDs are pinned to the original series.
// Themes are identified by their original performers; only matching Apple Music previews are used.
const wanted = [
  ['80', 199, '龙珠', 1986, [['OP', '摩訶不思議アドベンチャー!', '高橋洋樹'], ['ED', 'ロマンティックあげるよ', '橋本潮']]],
  ['80', 1129, '圣斗士星矢', 1986, [['OP', 'ペガサス幻想', 'MAKE-UP'], ['ED', '永遠ブルー', 'MAKE-UP']]],
  ['80', 1316, '城市猎人', 1987, [['OP', 'City Hunter 愛よ消えないで', '小比類巻かほる'], ['ED', 'Get Wild', 'TM NETWORK']]],
  ['80', 1451, '足球小将', 1983, [['OP', '燃えてヒーロー', '沖田浩之'], ['ED', '冬のライオン', '沖田浩之']]],
  ['80', 186, '乱马1/2', 1989, [['OP', 'じゃじゃ馬にさせないで', 'らんま1/2'], ['ED', 'プラトニックつらぬいて', '坂上香織']]],
  ['80', 720, '龙珠Z', 1989, [['OP', 'CHA-LA HEAD-CHA-LA', '影山ヒロノブ'], ['ED', 'でてこいとびきりZENKAIパワー', 'MANNA']]],
  ['90', 148, '灌篮高手', 1993, [['OP', '君が好きだと叫びたい', 'BAAD'], ['ED', 'あなただけ見つめてる', '大黒摩季']]],
  ['90', 489, '美少女战士', 1992, [['OP', 'Moonlight Legend', 'DALI', 'HK'], ['ED', 'Heart Moving', '高松美砂絵', 'HK']]],
  ['90', 21, '新世纪福音战士', 1995, [['OP', '残酷な天使のテーゼ', '高橋洋子'], ['ED', 'FLY ME TO THE MOON', 'CLAIRE']]],
  ['90', 486, '宝可梦', 1997, [['OP', 'めざせポケモンマスター', '松本梨香'], ['ED', 'ひゃくごじゅういち', 'オーキド博士']]],
  ['90', 207, '魔卡少女樱', 1998, [['OP', 'プラチナ', '坂本真綾'], ['ED', 'Groovy!', '広瀬香美']]],
  ['90', 509, '数码宝贝大冒险', 1999, [['OP', 'Butter-Fly', '和田光司'], ['ED', 'I wish', '前田愛']]],
  ['90', 210, '名侦探柯南', 1996, [['OP', '謎', '小松未歩'], ['ED', 'STEP BY STEP', 'ZIGGY']]],
  ['90', 12, '海贼王', 1999, [['OP', 'ウィーアー!', 'きただにひろし'], ['ED', 'memories', '大槻マキ']]],
  ['00', 11, '火影忍者', 2002, [['OP', '遥か彼方', 'ASIAN KUNG-FU GENERATION'], ['ED', 'Wind', 'Akeboshi']]],
  ['00', 224, '犬夜叉', 2000, [['OP', 'CHANGE THE WORLD', 'V6'], ['ED', 'My will', 'dream']]],
  ['00', 244, '死神', 2004, [['OP', 'アスタリスク', 'ORANGE RANGE'], ['ED', 'Life is Like a Boat', 'Rie fu']]],
  ['00', 100, '钢之炼金术师', 2003, [['OP', 'メリッサ', 'ポルノグラフィティ'], ['ED', '消せない罪', '北出菜奈']]],
  ['00', 1376, '死亡笔记', 2006, [['OP', 'the WORLD', 'NIGHTMARE'], ['ED', 'アルミナ', 'NIGHTMARE']]],
  ['00', 1415, '反叛的鲁路修', 2006, [['OP', 'COLORS', 'FLOW'], ['ED', '勇侠青春謳', 'ALI PROJECT']]],
  ['00', 114, '棋魂', 2001, [['OP', 'Get Over', 'dream'], ['ED', 'ヒトミノチカラ', '観月ありさ']]],
  ['00', 777, 'NANA', 2006, [['OP', 'rose', 'ANNA TSUCHIYA'], ['ED', 'a little pain', 'OLIVIA']]],
  ['10', 7442, '进击的巨人', 2013, [['OP', '紅蓮の弓矢', 'Linked Horizon'], ['ED', '美しき残酷な世界', '日笠陽子']]],
  ['10', 41370, '鬼灭之刃', 2019, [['OP', '紅蓮華', 'LiSA'], ['ED', 'from the edge', 'FictionJunction']]],
  ['10', 8133, '排球少年!!', 2014, [['OP', 'イマジネーション', 'SPYAIR'], ['ED', '天地ガエシ', 'NICO Touches the Walls']]],
  ['10', 11469, '我的英雄学院', 2016, [['OP', 'THE DAY', 'ポルノグラフィティ'], ['ED', 'HEROES', 'Brian the Sun']]],
  ['10', 10740, '一拳超人', 2015, [['OP', 'THE HERO !!', 'JAM Project'], ['ED', '星より先に見つけてあげる', '森口博子']]],
  ['10', 8403, '四月是你的谎言', 2014, [['OP', '光るなら', 'Goose house'], ['ED', 'キラメキ', 'wacci']]],
  ['10', 8271, '东京喰种', 2014, [['OP', 'unravel', 'TK from 凛として時雨'], ['ED', '聖者たち', 'People In The Box']]],
];

const normalize = value => String(value).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await sleep(450 * (i + 1));
  }
  throw new Error(`Failed: ${url}`);
}

function score(item, title, artist) {
  const actualTitle = normalize(item.trackName);
  const actualArtist = normalize(item.artistName);
  const wantedTitle = normalize(title);
  const wantedArtist = normalize(artist);
  let points = 0;
  if (actualTitle === wantedTitle) points += 12;
  else if (actualTitle.startsWith(wantedTitle)) points += 10;
  else if (actualTitle.includes(wantedTitle)) points += 7;
  if (actualArtist === wantedArtist) points += 12;
  else if (actualArtist.includes(wantedArtist) || wantedArtist.includes(actualArtist)) points += 9;
  if (/cover|カバー|オルゴール|カラオケ|instrumental|ピアノ|tribute|tribute|remix/i.test(item.trackName + ' ' + item.artistName)) points -= 8;
  return points;
}

const out = [];
const posterDir = path.resolve('public/posters');
await fs.mkdir(posterDir, { recursive: true });
for (const [era, kitsuId, title, year, themes] of wanted) {
  const anime = (await (await get(`https://kitsu.io/api/edge/anime/${kitsuId}`)).json()).data;
  const posterUrl = anime?.attributes?.posterImage?.large;
  if (!posterUrl) throw new Error(`Poster missing: ${title}`);
  const poster = `/posters/${kitsuId}.jpg`;
  const image = await get(posterUrl);
  await fs.writeFile(path.join(posterDir, path.basename(poster)), Buffer.from(await image.arrayBuffer()));
  const tracks = [];
  for (const [kind, song, performer, country = 'JP'] of themes) {
    const query = new URLSearchParams({ term: `${song} ${performer}`, entity: 'song', country, limit: '50' });
    const data = await (await get(`https://itunes.apple.com/search?${query}`)).json();
    const best = data.results.filter(item => item.previewUrl).map(item => ({ item, points: score(item, song, performer) })).sort((a, b) => b.points - a.points)[0];
    if (best?.points >= 16) {
      tracks.push({ kind, title: best.item.trackName, artist: best.item.artistName, preview: best.item.previewUrl, url: best.item.trackViewUrl });
      console.log(`${title} ${kind}: ${best.item.trackName} — ${best.item.artistName} [${best.points}]`);
    } else {
      console.warn(`MISSING ${title} ${kind}: ${song} — ${performer}; best=${best?.item.trackName ?? 'none'} / ${best?.item.artistName ?? ''} [${best?.points ?? 0}]`);
    }
    await sleep(110);
  }
  if (!tracks.length) throw new Error(`No verified OP or ED for ${title}`);
  out.push({ id: String(kitsuId), era, title, year, cover: poster, url: `https://kitsu.io/anime/${anime.attributes.slug}`, tracks });
  await sleep(180);
}
await fs.mkdir('src/data', { recursive: true });
await fs.writeFile('src/data/anime.json', JSON.stringify(out, null, 2));
console.log(`Saved ${out.length} anime; ${out.filter(item => item.tracks.length).length} with previews`);
