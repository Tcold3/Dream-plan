import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlbumCoverTunnel } from './components/AlbumCoverTunnel';
import type { AlbumCoverTunnelOptions } from './components/AlbumCoverTunnelEngine';
import catalog from './data/albums.json';

type Track = { title: string; preview: string; url: string };
type Album = { id: string; era: string; title: string; artist: string; year: number; cover: string; url: string; tracks: Track[] };
type Era = 'all' | '70' | '80' | '90' | '00' | '10' | '20';

const albums = catalog as Album[];
const eras: { id: Era; label: string }[] = [
  { id: 'all', label: '全部年代' },
  { id: '70', label: '70年代' },
  { id: '80', label: '80年代' },
  { id: '90', label: '90年代' },
  { id: '00', label: '00年代' },
  { id: '10', label: '10年代' },
  { id: '20', label: '20年代' },
];

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeBatch(era: Era, previous: string[] = []): Album[] {
  const pool = era === 'all' ? albums : albums.filter(album => album.era === era);
  if (era !== 'all') return shuffle(pool);
  const picked = shuffle(pool.filter(album => !previous.includes(album.id))).slice(0, 12);
  if (picked.length < 12) picked.push(...shuffle(pool.filter(album => !picked.includes(album))).slice(0, 12 - picked.length));
  return picked;
}

function PlayIcon({ playing = false }: { playing?: boolean }) {
  return playing ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg> :
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5a1 1 0 0 1 1.52-.85l10 6.5a1 1 0 0 1 0 1.7l-10 6.5A1 1 0 0 1 8 18.5z"/></svg>;
}

function ShuffleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m17 3 4 4-4 4"/><path d="M3 17h4c5 0 5-10 10-10h4"/><path d="m17 13 4 4-4 4"/><path d="M3 7h4c2 0 3 1.5 4 3"/><path d="M14 14c1 1.8 2 3 3 3h4"/></svg>;
}

function App() {
  const [era, setEra] = useState<Era>('all');
  const [batch, setBatch] = useState<Album[]>(() => makeBatch('all'));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [current, setCurrent] = useState<{ album: Album; track: Track } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [height, setHeight] = useState(() => typeof window === 'undefined' ? 610 : Math.max(400, Math.min(690, Math.round(window.innerHeight * .67))));
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const onResize = () => setHeight(Math.max(400, Math.min(690, Math.round(window.innerHeight * .67))));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const playAlbum = useCallback((album: Album, index: number) => {
    const track = album.tracks[Math.floor(Math.random() * album.tracks.length)];
    if (!track || !audio.current) return;
    setSelectedIndex(index);
    setCurrent({ album, track });
    setAudioError(false);
    audio.current.src = track.preview;
    audio.current.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setAudioError(true); });
  }, []);

  const onSelect = useCallback((index: number) => {
    const album = batch[index];
    if (album) playAlbum(album, index);
  }, [batch, playAlbum]);

  const switchEra = (next: Era) => {
    setEra(next);
    setBatch(makeBatch(next));
    setSelectedIndex(null);
  };

  const changeBatch = () => {
    setBatch(makeBatch(era, batch.map(album => album.id)));
    setSelectedIndex(null);
  };

  const randomPlay = () => {
    if (!batch.length) return;
    const candidates = batch.map((_, i) => i).filter(i => i !== selectedIndex);
    const index = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
    playAlbum(batch[index], index);
  };

  const togglePlay = () => {
    if (!audio.current) return;
    if (!current) { randomPlay(); return; }
    if (playing) { audio.current.pause(); setPlaying(false); }
    else audio.current.play().then(() => setPlaying(true)).catch(() => setAudioError(true));
  };

  const tunnelOptions = useMemo<AlbumCoverTunnelOptions>(() => ({
    images: batch.map(album => ({ src: album.cover, alt: `${album.title} — ${album.artist}` })),
    active: selectedIndex ?? undefined,
    onSelect,
    height,
    theme: 'dark',
    autoTravel: true,
  }), [batch, selectedIndex, onSelect, height]);

  return <div className="page-shell">
    <header className="site-header">
      <a className="brand" href="#top" aria-label="时光声廊首页"><span className="brand-mark"><i/><i/><i/></span><span>时光声廊<span className="brand-en">TIME TUNNEL RADIO</span></span></a>
      <div className="header-right"><span className="on-air"><span/> 正在漫游</span><a href="#about" className="header-about">关于这个电台 <span>↗</span></a></div>
    </header>

    <main id="top">
      <section className="intro" aria-labelledby="page-title">
        <div className="intro-main"><p className="serial">NO. 001 / RANDOM LISTENING EXPERIENCE</p><h1 id="page-title">把耳朵交给<br/><em>另一个年代。</em></h1></div>
        <div className="intro-side"><span className="starburst">✳</span><p>从一张封面出发，<br/>偶遇一首刚好属于此刻的歌。</p><span className="intro-note">向下滑动隧道，或点一张封面开始听。</span></div>
      </section>

      <section className="explore" aria-label="探索专辑">
        <div className="toolbar"><div className="era-switch" role="group" aria-label="选择年代">{eras.map(item => <button key={item.id} className={era === item.id ? 'era active' : 'era'} type="button" onClick={() => switchEra(item.id)} aria-pressed={era === item.id}>{item.label}</button>)}</div><button className="refresh" type="button" onClick={changeBatch}><span>↻</span> 换一批</button></div>
        <div className="tunnel-wrap">
          {batch.length > 0 && <AlbumCoverTunnel options={tunnelOptions} className="tunnel" />}
          <div className="tunnel-topline"><span>EXPLORE THE SOUND</span><span>{era === 'all' ? '跨越年代' : `${Number(era) >= 70 ? '19' : '20'}${era}S`}</span></div>
          <div className="tunnel-bottomline"><span>SCROLL TO TRAVEL <b>↓</b></span><span>当前 {batch.length} 张封面</span></div>
        </div>
        <div className="explore-footer"><p>每一次穿越，都有新的声音等你发现。</p><button className="random-button" onClick={randomPlay} type="button"><ShuffleIcon/> 随机听一首 <span>↗</span></button></div>
      </section>

      <section className="now-playing" aria-label="正在播放">
        <div className="now-label"><span className="pulse-bars"><i/><i/><i/><i/></span><span>NOW PLAYING<br/><strong>此刻的声音</strong></span></div>
        {current ? <><img src={current.album.cover} alt={`${current.album.title} 专辑封面`} className="mini-cover"/><div className="track-info"><p>{current.album.year} · {current.album.title}</p><h2>{current.track.title}</h2><span>{current.album.artist}</span>{audioError && <small>试听暂时无法播放，请前往音乐平台收听。</small>}</div><div className="player-actions"><button className="player-control" onClick={togglePlay} type="button" aria-label={playing ? '暂停' : '播放'}><PlayIcon playing={playing}/></button><button className="next-control" onClick={randomPlay} type="button" aria-label="下一首随机歌曲">→</button><a href={current.track.url || current.album.url} target="_blank" rel="noreferrer" className="platform-link">在 Apple Music 中打开 ↗</a></div></> : <><div className="empty-vinyl"><div/></div><p className="empty-copy">还没有选中歌曲。<br/><span>点一张封面，或让命运随机挑选。</span></p><button className="empty-action" type="button" onClick={randomPlay}>开始听 <span>↗</span></button></>}
      </section>
    </main>

    <footer id="about"><span>时光声廊 © 2026</span><p>精选跨年代热门专辑 · Apple Music 提供 30 秒试听片段。封面与音乐版权归各权利人所有。</p><a href="#top">回到顶部 ↑</a></footer>
    <audio ref={audio} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setAudioError(true); }}/>
  </div>;
}

export default App;
