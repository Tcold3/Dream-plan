import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AlbumCoverTunnelOptions } from './components/AlbumCoverTunnelEngine';
import { TactileWelcomeButton } from './components/TactileWelcomeButton';
import catalog from './data/anime.json';

type Track = { kind: 'OP' | 'ED'; title: string; artist: string; preview: string; url: string };
type Anime = { id: string; era: string; title: string; year: number; cover: string; url: string; tracks: Track[] };
type Era = 'all' | '80' | '90' | '00' | '10';

const animeCatalog = (catalog as Anime[])
  .filter(anime => anime.tracks.length > 0)
  .map(anime => ({ ...anime, cover: `${import.meta.env.BASE_URL}${anime.cover.replace(/^\//, '')}` }));
const animeByCover = new Map(animeCatalog.map(anime => [anime.cover, anime]));
const AlbumCoverTunnel = lazy(() => import('./components/AlbumCoverTunnel').then(module => ({ default: module.AlbumCoverTunnel })));
const eras: { id: Era; label: string }[] = [
  { id: 'all', label: '全部年代' },
  { id: '80', label: '80年代' },
  { id: '90', label: '90年代' },
  { id: '00', label: '00年代' },
  { id: '10', label: '10年代' },
];

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeBatch(era: Era, previous: string[] = []): Anime[] {
  const pool = era === 'all' ? animeCatalog : animeCatalog.filter(anime => anime.era === era);
  const size = Math.min(era === 'all' ? 12 : 3, pool.length);
  const picked = shuffle(pool.filter(anime => !previous.includes(anime.id))).slice(0, size);
  if (picked.length < size) picked.push(...shuffle(pool.filter(anime => !picked.includes(anime))).slice(0, size - picked.length));
  return picked;
}

function PlayIcon({ playing = false }: { playing?: boolean }) {
  return playing ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg> :
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5a1 1 0 0 1 1.52-.85l10 6.5a1 1 0 0 1 0 1.7l-10 6.5A1 1 0 0 1 8 18.5z"/></svg>;
}

function ShuffleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m17 3 4 4-4 4"/><path d="M3 17h4c5 0 5-10 10-10h4"/><path d="m17 13 4 4-4 4"/><path d="M3 7h4c2 0 3 1.5 4 3"/><path d="M14 14c1 1.8 2 3 3 3h4"/></svg>;
}

function LoadingMonogram({ progress }: { progress: number }) {
  const shape = 'M6 213C20 185 26 65 39 29H75L120 128L165 29H201C214 65 220 185 234 213H185L172 108L135 181H105L68 108L55 213Z';
  const fillHeight = 184 * Math.min(100, Math.max(0, progress)) / 100;
  return <svg className="loading-monogram" viewBox="0 0 240 240" role="progressbar" aria-label="封面加载进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
    <defs><clipPath id="loading-m-shape"><path d={shape}/></clipPath><linearGradient id="loading-m-color" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#8ed7ed"/><stop offset="1" stopColor="#6798e5"/></linearGradient></defs>
    <rect x="0" y={213 - fillHeight} width="240" height={fillHeight} fill="url(#loading-m-color)" clipPath="url(#loading-m-shape)"/>
    <path d={shape} fill="none" stroke="#a8c7eb" strokeWidth="3" strokeLinejoin="round"/>
  </svg>;
}

function App() {
  const [entered, setEntered] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'travel' | 'ready'>('loading');
  const [era, setEra] = useState<Era>('all');
  const [batch, setBatch] = useState<Anime[]>(() => makeBatch('all'));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [current, setCurrent] = useState<{ anime: Anime; track: Track } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [height, setHeight] = useState(560);
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState('');
  const loadGeneration = useRef(0);
  const batchLoadingRef = useRef(false);
  const audio = useRef<HTMLAudioElement>(null);
  const tunnelHost = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!entered || !tunnelHost.current) return;
    const host = tunnelHost.current;
    const updateHeight = () => setHeight(Math.max(340, Math.round(host.clientHeight)));
    const observer = new ResizeObserver(updateHeight);
    observer.observe(host);
    updateHeight();
    return () => observer.disconnect();
  }, [entered]);

  const playAnime = useCallback((anime: Anime, index: number, kind?: 'OP' | 'ED') => {
    const choices = kind ? anime.tracks.filter(track => track.kind === kind) : anime.tracks;
    const track = choices[Math.floor(Math.random() * choices.length)];
    if (!track || !audio.current) return;
    setSelectedIndex(index >= 0 ? index : null);
    setCurrent({ anime, track });
    setAudioError(false);
    audio.current.src = track.preview;
    audio.current.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setAudioError(true); });
  }, []);

  const onSelect = useCallback((index: number, src?: string) => {
    const anime = (src && animeByCover.get(src)) || batch[index];
    if (anime) playAnime(anime, batch.findIndex(item => item.id === anime.id));
  }, [batch, playAnime]);

  const switchEra = (next: Era) => {
    loadGeneration.current++;
    batchLoadingRef.current = true;
    setBatchLoading(true);
    setLoadError('');
    audio.current?.pause();
    setPlaying(false);
    setCurrent(null);
    setEra(next);
    setBatch(makeBatch(next));
    setSelectedIndex(null);
  };

  const changeBatch = () => {
    loadGeneration.current++;
    batchLoadingRef.current = true;
    setBatchLoading(true);
    setLoading(phase === 'loading');
    setLoadProgress(0);
    setLoadError('');
    audio.current?.pause();
    setPlaying(false);
    setCurrent(null);
    setBatch(makeBatch(era, batch.map(anime => anime.id)));
    setSelectedIndex(null);
  };

  const randomPlay = () => {
    if (!batch.length) return;
    const candidates = batch.map((_, i) => i).filter(i => i !== selectedIndex);
    const index = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
    playAnime(batch[index], index);
  };

  const togglePlay = () => {
    if (!audio.current) return;
    if (!current) { randomPlay(); return; }
    if (playing) { audio.current.pause(); setPlaying(false); }
    else audio.current.play().then(() => setPlaying(true)).catch(() => setAudioError(true));
  };

  const leave = () => {
    loadGeneration.current++;
    batchLoadingRef.current = false;
    setBatchLoading(false);
    setPhase('loading');
    setLoading(true);
    setLoadProgress(0);
    setLoadError('');
    audio.current?.pause();
    setPlaying(false);
    setEntered(false);
  };

  const onAdvance = useCallback(() => {
    if (phase !== 'ready' || batchLoadingRef.current) return;
    loadGeneration.current++;
    batchLoadingRef.current = true;
    setBatchLoading(true);
    setSelectedIndex(null);
    setBatch(previous => makeBatch(era, previous.map(anime => anime.id)));
  }, [era, phase]);

  const tunnelImages = useMemo(() => batch.map(anime => ({ src: anime.cover, alt: `${anime.title} — ${anime.year}` })), [batch]);
  const tunnelOptions = useMemo<AlbumCoverTunnelOptions>(() => {
    const generation = loadGeneration.current;
    return {
      images: tunnelImages,
      active: selectedIndex ?? undefined,
      onSelect,
      onAdvance,
      introStage: phase,
      onProgress: percent => { if (generation === loadGeneration.current && phase === 'loading') setLoadProgress(percent); },
      onReady: () => {
        if (generation !== loadGeneration.current) return;
        batchLoadingRef.current = false;
        setBatchLoading(false);
        if (phase !== 'loading') return;
        setLoadProgress(100);
        window.setTimeout(() => {
          if (generation !== loadGeneration.current) return;
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setLoading(false); setPhase('ready'); return; }
          setPhase('travel');
          window.setTimeout(() => { if (generation === loadGeneration.current) setLoading(false); }, 420);
          window.setTimeout(() => { if (generation === loadGeneration.current) setPhase('ready'); }, 1750);
        }, 300);
      },
      onError: message => { if (generation === loadGeneration.current) { batchLoadingRef.current = false; setBatchLoading(false); setLoadError(message); setLoading(false); } },
      height,
      theme: 'light',
      autoTravel: false,
    };
  }, [tunnelImages, selectedIndex, onSelect, onAdvance, phase, height, entered]);

  return <div className="page-shell">
    {!entered ? <main className="welcome-screen" aria-label="欢迎回到梦开始的地方">
      <TactileWelcomeButton onClick={() => setEntered(true)} />
    </main> : <main className={`experience${phase !== 'ready' ? ' entering' : ''}`} aria-label="动漫主题曲隧道">
      <header className="site-header">
        <button className="brand" type="button" onClick={leave} aria-label="返回欢迎页"><span className="brand-title">梦开始的地方</span><span className="brand-en">ANIME THEME RADIO</span></button>
        <div className="header-right"><span className="on-air"><span/> 80、90 后的动漫记忆</span></div>
      </header>
      <div className="toolbar">
        <div className="era-switch" role="group" aria-label="选择年代">{eras.map(item => <button key={item.id} className={era === item.id ? 'era active' : 'era'} type="button" onClick={() => switchEra(item.id)} aria-pressed={era === item.id}>{item.label}</button>)}</div>
        <div className="toolbar-actions"><button className="random-button" onClick={randomPlay} type="button"><ShuffleIcon/> 随机听一首</button></div>
      </div>
      <section className="tunnel-wrap" aria-label="探索动漫封面" aria-busy={loading || batchLoading} ref={tunnelHost}>
        {batch.length > 0 && <Suspense fallback={null}><AlbumCoverTunnel options={tunnelOptions} className="tunnel" /></Suspense>}
        {(loading || loadError) && <div className={`tunnel-loading${phase === 'travel' ? ' exiting' : ''}`} role="status" aria-live="polite">
          <div className="loading-tunnel" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i}/>)}</div>
          {loadError ? <div className="loading-error"><LoadingMonogram progress={0}/><p>{loadError}</p><button type="button" onClick={changeBatch}>换一批重试</button></div> : <LoadingMonogram progress={loadProgress}/>}
        </div>}
        <div className="tunnel-topline"><span>轻触动漫封面，重听那段旋律</span><span>{era === 'all' ? '跨越年代' : `${Number(era) >= 70 ? '19' : '20'}${era}S`}</span></div>
        <div className="tunnel-bottomline"><span>向下滚动 · 自动遇见下一批 <b>↓</b></span><span>当前 {batch.length} 部动画</span></div>
      </section>
      <section className="now-playing" aria-label="正在播放">
        <div className="now-label"><span className="pulse-bars"><i/><i/><i/><i/></span><span>NOW PLAYING<br/><strong>此刻的声音</strong></span></div>
        {current ? <><img src={current.anime.cover} alt={`${current.anime.title} 动漫封面`} className="mini-cover"/><div className="track-info"><p>{current.anime.year} · {current.anime.title}</p><h2>{current.track.title}</h2><div className="track-meta"><span>{current.track.kind} · {current.track.artist}</span><div className="theme-tabs">{(['OP','ED'] as const).filter(kind => current.anime.tracks.some(track => track.kind === kind)).map(kind => <button type="button" key={kind} className={current.track.kind === kind ? 'active' : ''} onClick={() => playAnime(current.anime, batch.findIndex(anime => anime.id === current.anime.id), kind)} aria-label={`播放${kind}`}>{kind}</button>)}</div></div>{audioError && <small>试听暂时无法播放，请前往音乐平台收听。</small>}</div><div className="player-actions"><button className="player-control" onClick={togglePlay} type="button" aria-label={playing ? '暂停' : '播放'}><PlayIcon playing={playing}/></button><button className="next-control" onClick={randomPlay} type="button" aria-label="下一首随机歌曲">→</button><a href={current.track.url} target="_blank" rel="noreferrer" className="platform-link">在 Apple Music 中打开 ↗</a></div></> : <><div className="empty-vinyl"><div/></div><p className="empty-copy">熟悉的旋律，等你按下播放。<br/><span>点一张动漫封面，或随机听一首 OP / ED。</span></p><button className="empty-action" type="button" onClick={randomPlay}>开始听 <span>↗</span></button></>}
      </section>
      <footer className="legal-line">精选 1980 年代至 2010 年代动漫 OP / ED · 海报资料来自 Kitsu，试听来自 Apple Music · 图片与音乐版权归各权利人所有</footer>
    </main>}
    <audio ref={audio} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setAudioError(true); }}/>
  </div>;
}

export default App;
