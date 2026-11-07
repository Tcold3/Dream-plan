import fs from 'node:fs/promises';
import path from 'node:path';

// Curated original releases across mainland China, Hong Kong, and Taiwan.
// Apple Music collection IDs point to the matching album, not search results or later compilations.
const wanted = [
  ['80', '新长征路上的摇滚', '崔健', 1989, 1585625540],
  ['80', '狼', '齐秦', 1985, 1895798728],
  ['80', '爱人同志', '罗大佑', 1988, 1720913316],
  ['80', '爱的根源', '谭咏麟', 1984, 1443309706],
  ['80', '风继续吹', '张国荣', 1983, 892682410],
  ['80', '狼(II)', '齐秦', 1987, 1895596565],
  ['80', '未来的主人翁', '罗大佑', 1983, 1720704718],
  ['80', '雾之恋', '谭咏麟', 1984, 1442951074],
  ['80', '似水流年', '梅艳芳', 1985, 1889764576],
  ['90', '黑豹', '黑豹乐队', 1992, 177025348],
  ['90', '唐朝', '唐朝乐队', 1992, 1622563433],
  ['90', '在别处', '许巍', 1997, 1060981602],
  ['90', '吻别', '张学友', 1993, 1443431909],
  ['90', '浮躁', '王菲', 1996, 1443287350],
  ['90', '我去2000年', '朴树', 1999, 1063212942],
  ['90', '乐与怒', 'Beyond', 1993, 1722083311],
  ['90', '天空', '王菲', 1994, 1443363496],
  ['90', '无能的力量', '崔健', 1998, 1590971366],
  ['00', '范特西', '周杰伦', 2001, 1721454234],
  ['00', '叶惠美', '周杰伦', 2003, 1721464893],
  ['00', '七里香', '周杰伦', 2004, 1721450027],
  ['00', '生如夏花', '朴树', 2003, 369655124],
  ['00', '2002年的第一场雪', '刀郎', 2004, 1783038001],
  ['00', 'U87', '陈奕迅', 2005, 1443374875],
  ['00', '时光·漫步', '许巍', 2002, 905191001],
  ['00', '看我72变', '蔡依林', 2003, 320494434],
  ['00', '皇后与梦想', '李宇春', 2006, 1058780440],
  ['10', '模特', '李荣浩', 2013, 1743353783],
  ['10', '赵小雷', '赵雷', 2011, 1722413125],
  ['10', '如也', '陈粒', 2015, 1413542639],
  ['10', '初学者', '薛之谦', 2016, 1787929894],
  ['10', '平凡的一天', '毛不易', 2018, 1718657000],
  ['10', '异类', '华晨宇', 2015, 1634556068],
  ['10', '飞行器的执行周期', '郭顶', 2016, 1443637757],
  ['10', '无法长大', '赵雷', 2016, 1722409813],
  ['10', '万能青年旅店', '万能青年旅店', 2010, 1538548871],
  ['20', '冀西南林路行', '万能青年旅店', 2020, 1545534900],
  ['20', '呼吸之野', '许嵩', 2021, 1567365066],
  ['20', '署前街少年', '赵雷', 2022, 1722409787],
  ['20', '幼鸟指南', '毛不易', 2021, 1787484072],
  ['20', '反深代词', '周深', 2024, 1770685141],
  ['20', '飞狗', '崔健', 2021, 1580691270],
  ['20', '山歌寥哉', '刀郎', 2023, 1782052101],
  ['20', '最伟大的作品', '周杰伦', 2022, 1721454339],
  ['20', '无数', '薛之谦', 2022, 1787448335],
];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response;
    await wait(400 * (attempt + 1));
  }
  throw new Error(`Failed: ${url}`);
}

const coverDir = path.resolve('public/covers');
await fs.mkdir(coverDir, { recursive: true });
const out = [];
for (const [era, title, artist, year, collectionId] of wanted) {
  const lookup = await (await get(`https://itunes.apple.com/lookup?id=${collectionId}&entity=song&country=HK&limit=100`)).json();
  const album = lookup.results.find(item => item.wrapperType === 'collection' && item.collectionId === collectionId);
  if (!album || !album.artworkUrl100) throw new Error(`Album missing: ${title}`);
  const tracks = lookup.results.filter(item => item.wrapperType === 'track' && item.previewUrl && item.collectionId === collectionId)
    .map(item => ({ title: item.trackName, preview: item.previewUrl, url: item.trackViewUrl }));
  if (tracks.length < 1) throw new Error(`No previews: ${title}`);
  const cover = `/covers/${era}-${collectionId}.jpg`;
  const imageUrl = album.artworkUrl100.replace(/\/100x100bb\.(jpg|png)$/, '/600x600bb.$1');
  const image = await get(imageUrl);
  await fs.writeFile(path.join(coverDir, path.basename(cover)), Buffer.from(await image.arrayBuffer()));
  out.push({ id: String(collectionId), era, title, artist, year, cover, url: album.collectionViewUrl, tracks });
  console.log(`${year} · ${artist}《${title}》 · ${tracks.length} tracks`);
  await wait(120);
}
if (out.length !== wanted.length) throw new Error(`Incomplete catalog: ${out.length}/${wanted.length}`);
await fs.mkdir('src/data', { recursive: true });
await fs.writeFile('src/data/albums.json', JSON.stringify(out, null, 2));
const keep = new Set(out.map(item => path.basename(item.cover)));
for (const file of await fs.readdir(coverDir)) {
  if (!keep.has(file)) await fs.unlink(path.join(coverDir, file));
}
console.log(`Saved ${out.length} Chinese albums`);
