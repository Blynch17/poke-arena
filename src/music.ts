// Música del juego.
//
// Cada tema (select, battle, victory, defeat) se busca primero como archivo local en public/music/
// (battle.mp3, battle.ogg, battle.m4a o battle.wav). Si no existe, suena un tema chiptune original
// sintetizado con Web Audio: dos ondas de pulso, una triangular y ruido, como los canales del Game Boy.
// Los archivos de public/music/ no se suben al repositorio (ver .gitignore).

import { settings } from './settings';

export type Track = 'select' | 'battle' | 'victory' | 'defeat' | 'world';

// ---------- partituras ----------
// Cada voz es una cadena de eventos separados por espacios: "A4:2" = La4 durante 2 pasos (semicorcheas),
// "." = silencio, y en la batería k = bombo, s = caja, h = platillo. Sin ":n", dura 1 paso.

type Wave = 'pulse25' | 'pulse50' | 'tri' | 'drums';
interface VoiceDef { wave: Wave; gain: number; score: string }
interface SongDef { bpm: number; loop: boolean; voices: VoiceDef[] }

const bars = (...b: string[]) => b.join(' ');

// Arpegio de un acorde, 16 pasos por compás.
const ARP = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 2, 1];
const arp = (chord: [string, string, string]) => ARP.map((i) => chord[i]).join(' ');
// Bajo en corcheas saltando a la octava.
const bass = (root: string, octave: string) =>
  [root, root, octave, root, root, root, octave, root].map((n) => `${n}:2`).join(' ');
const DRUMS = 'k . h . s . h . k . h k s . h .';

const CH = {
  Am: ['A3', 'C4', 'E4'], F: ['F3', 'A3', 'C4'], G: ['G3', 'B3', 'D4'], E: ['E3', 'G#3', 'B3'],
  Dm: ['D3', 'F3', 'A3'], C: ['C4', 'E4', 'G4'],
} as Record<string, [string, string, string]>;

// Compases de 16 pasos de la melodía principal de la batalla.
const BATTLE_LEAD = bars(
  'A4:2 .:1 C5:2 E5:2 .:1 A5:2 G5:1 E5:1 C5:2 .:2',
  'F4:2 .:1 A4:2 C5:2 .:1 F5:2 E5:1 C5:1 A4:2 .:2',
  'G4:2 .:1 B4:2 D5:2 .:1 G5:2 F5:1 D5:1 B4:2 .:2',
  'E4:2 .:1 G#4:2 B4:2 .:1 E5:2 D5:1 B4:1 G#4:2 E5:2',
  'A5:3 G5:1 E5:2 C5:2 E5:3 G5:1 A5:2 .:2',
  'A5:3 C6:1 A5:2 F5:2 A5:3 G5:1 F5:2 .:2',
  'B5:3 A5:1 G5:2 D5:2 G5:3 B5:1 D6:2 .:2',
  'E5:2 G#5:2 B5:2 E6:2 D6:2 B5:2 G#5:2 E5:2',
  'D5:2 F5:2 A5:2 F5:2 D5:2 F5:2 A5:2 D6:2',
  'C6:2 A5:2 F5:2 A5:2 C6:4 .:2 A5:2',
  'E5:2 G#5:2 B5:2 G#5:2 E5:2 G#5:2 B5:2 E6:2',
  'D6:2 B5:2 G#5:2 B5:2 D6:4 .:2 B5:2',
  'F5:2 A5:2 C6:2 A5:2 F5:2 A5:2 C6:2 F6:2',
  'G5:2 B5:2 D6:2 B5:2 G5:2 B5:2 D6:2 G6:2',
  'A5:4 C6:4 E6:4 A5:2 C6:2',
  'E6:2 D6:2 B5:2 G#5:2 E5:2 G#5:2 B5:2 E6:2',
);

const BATTLE_PROG = ['Am', 'F', 'G', 'E', 'Am', 'F', 'G', 'E', 'Dm', 'Dm', 'E', 'E', 'F', 'G', 'Am', 'E'];
const ROOT: Record<string, [string, string]> = {
  Am: ['A2', 'A3'], F: ['F2', 'F3'], G: ['G2', 'G3'], E: ['E2', 'E3'], Dm: ['D2', 'D3'], C: ['C3', 'C4'],
};

// Tema del camino: alegre y tranquilo, en Do mayor.
const WORLD_PROG = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'];
const WORLD_LEAD = bars(
  'E5:2 G5:2 E5:2 C5:2 D5:2 E5:2 D5:2 C5:2',
  'C5:2 E5:2 A5:2 E5:2 C5:2 E5:2 D5:4',
  'A5:2 C6:2 A5:2 F5:2 G5:2 A5:2 G5:2 F5:2',
  'D5:2 G5:2 B5:2 G5:2 D5:2 G5:4 .:2',
  'E5:2 G5:2 C6:4 B5:2 A5:2 G5:2 E5:2',
  'A5:2 E5:2 A5:2 C6:2 B5:2 A5:2 E5:4',
  'F5:2 A5:2 C6:2 A5:2 G5:2 F5:2 E5:2 D5:2',
  'D5:2 E5:2 G5:2 B5:2 C6:8',
);
const LIGHT_DRUMS = 'k . . . s . . . k . . . s . . .';

const SONGS: Record<Track, SongDef> = {
  world: {
    bpm: 112, loop: true,
    voices: [
      { wave: 'pulse50', gain: 0.38, score: WORLD_LEAD },
      { wave: 'pulse25', gain: 0.18, score: bars(...WORLD_PROG.map((c) => arp(CH[c]))) },
      { wave: 'tri', gain: 0.6, score: bars(...WORLD_PROG.map((c) => bass(...ROOT[c]))) },
      { wave: 'drums', gain: 0.3, score: bars(...WORLD_PROG.map(() => LIGHT_DRUMS)) },
    ],
  },
  battle: {
    bpm: 168, loop: true,
    voices: [
      { wave: 'pulse50', gain: 0.5, score: BATTLE_LEAD },
      { wave: 'pulse25', gain: 0.22, score: bars(...BATTLE_PROG.map((c) => arp(CH[c]))) },
      { wave: 'tri', gain: 0.7, score: bars(...BATTLE_PROG.map((c) => bass(...ROOT[c]))) },
      { wave: 'drums', gain: 0.55, score: bars(...BATTLE_PROG.map(() => DRUMS)) },
    ],
  },
  select: {
    bpm: 116, loop: true,
    voices: [
      {
        wave: 'pulse50', gain: 0.4,
        score: bars(
          'E5:4 D5:2 C5:2 D5:4 E5:4', 'C5:4 A4:2 C5:2 F5:6 .:2', 'G5:4 F5:2 E5:2 D5:4 E5:4', 'D5:6 B4:2 G4:8',
          'E5:4 D5:2 C5:2 D5:4 E5:4', 'C5:4 A4:2 C5:2 F5:6 .:2', 'G5:4 E5:2 D5:2 C5:4 D5:4', 'C5:12 .:4',
        ),
      },
      { wave: 'pulse25', gain: 0.2, score: bars(...['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'].map((c) => arp(CH[c]))) },
      { wave: 'tri', gain: 0.6, score: bars(...['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'].map((c) => bass(...ROOT[c]))) },
    ],
  },
  victory: {
    bpm: 150, loop: false,
    voices: [
      { wave: 'pulse50', gain: 0.5, score: 'C5:2 E5:2 G5:2 C6:4 .:2 G5:2 C6:8' },
      { wave: 'pulse25', gain: 0.25, score: 'E4:2 G4:2 C5:2 E5:4 .:2 C5:2 E5:8' },
      { wave: 'tri', gain: 0.6, score: 'C3:4 G2:4 C3:14' },
    ],
  },
  defeat: {
    bpm: 80, loop: false,
    voices: [
      { wave: 'pulse50', gain: 0.45, score: 'E5:4 D5:4 C5:4 A4:8 .:4' },
      { wave: 'tri', gain: 0.6, score: 'A2:8 F2:8 E2:8' },
    ],
  },
};

// ---------- motor ----------

interface Ev { at: number; len: number; freq: number | null; drum: string | null }
interface Voice { wave: Wave; gain: number; byStep: Map<number, Ev> }
interface Compiled { stepSec: number; total: number; loop: boolean; voices: Voice[] }

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freqOf(n: string): number {
  const m = /^([A-G])(#?)(\d)$/.exec(n);
  if (!m) throw new Error(`Nota inválida: ${n}`);
  const semis = NAMES[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12 - 9; // distancia a La4
  return 440 * Math.pow(2, semis / 12);
}

function compile(def: SongDef, name: string): Compiled {
  let total = 0;
  const voices = def.voices.map((v) => {
    const byStep = new Map<number, Ev>();
    let at = 0;
    for (const tok of v.score.split(/\s+/).filter(Boolean)) {
      const [what, l] = tok.split(':');
      const len = l ? Number(l) : 1;
      if (what !== '.') {
        byStep.set(at, v.wave === 'drums'
          ? { at, len, freq: null, drum: what }
          : { at, len, freq: freqOf(what), drum: null });
      }
      at += len;
    }
    if (total && at !== total) console.error(`[music] ${name}: una voz mide ${at} pasos y otra ${total}`);
    total = Math.max(total, at);
    return { wave: v.wave, gain: v.gain, byStep };
  });
  return { stepSec: 60 / def.bpm / 4, total, loop: def.loop, voices };
}

function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 32, real = new Float32Array(n), imag = new Float32Array(n);
  for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

const EXT = ['mp3', 'ogg', 'm4a', 'wav'];

class MusicPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private waves: Record<string, PeriodicWave> = {};
  private fileCache = new Map<Track, AudioBuffer | null>();
  private want: Track | null = null;
  private current: Track | null = null;
  private timer: number | null = null;
  private fileSrc: AudioBufferSourceNode | null = null;
  private muted = false;
  private gesture = false;
  private token = 0; // invalida lecturas de archivo que llegan tarde
  scheduled = 0; // notas programadas (para depurar)

  constructor() {
    try { this.muted = localStorage.getItem('musicMuted') === '1'; } catch { /* sin almacenamiento */ }
    const unlock = () => {
      this.gesture = true;
      void this.ensure().then(() => { if (this.want && !this.current) void this.play(this.want); });
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') this.toggleMute();
    });
  }

  get isMuted() { return this.muted; }

  /** Aplica los volúmenes de los ajustes. La curva es cuadrática: el oído nota mejor los pasos bajos así. */
  applyVolumes(now = false) {
    if (!this.ctx || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const set = (g: GainNode, v: number) => {
      if (now) g.gain.value = v;
      else g.gain.setTargetAtTime(v, t, 0.02);
    };
    set(this.musicBus, (settings.music / 10) ** 2);
    set(this.sfxBus, 2.2 * (settings.sfx / 10) ** 2);
  }

  /** Audio compartido para los efectos de sonido; null hasta que haya habido una tecla o clic. */
  audio(): { ctx: AudioContext; out: AudioNode; noise: AudioBuffer } | null {
    if (!this.ctx || !this.sfxBus || !this.noise || this.ctx.state !== 'running') return null;
    return { ctx: this.ctx, out: this.sfxBus, noise: this.noise };
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('musicMuted', this.muted ? '1' : '0'); } catch { /* sin almacenamiento */ }
    this.master?.gain.setTargetAtTime(this.muted ? 0 : 0.22, this.ctx?.currentTime ?? 0, 0.03);
  }

  private async ensure(): Promise<AudioContext | null> {
    if (!this.gesture) return null; // el navegador solo deja sonar tras una tecla o clic
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const comp = this.ctx.createDynamicsCompressor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(comp).connect(this.ctx.destination);
      // Dos buses con volumen propio (ajustes 0-10); comparten el silencio general (tecla M).
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.applyVolumes(true);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.waves = { pulse25: pulseWave(this.ctx, 0.25), pulse50: pulseWave(this.ctx, 0.5) };
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  /** Reproduce un tema; reemplaza al que suene. Si aún no hubo tecla o clic, queda en espera. */
  async play(track: Track) {
    this.want = track;
    if (this.current === track) return;
    const my = ++this.token;
    this.stopNow();
    const ctx = await this.ensure();
    if (!ctx || my !== this.token) return;
    const buf = await this.loadFile(track);
    if (my !== this.token) return;
    this.current = track;
    if (buf) this.playFile(buf, track);
    else this.playSynth(track);
  }

  stop() {
    this.want = null;
    this.token++;
    this.stopNow();
  }

  private stopNow() {
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    try { this.fileSrc?.stop(); } catch { /* ya detenido */ }
    this.fileSrc = null;
    this.current = null;
  }

  // ---- archivo local ----
  private async loadFile(track: Track): Promise<AudioBuffer | null> {
    if (this.fileCache.has(track)) return this.fileCache.get(track)!;
    let buf: AudioBuffer | null = null;
    for (const ext of EXT) {
      try {
        const res = await fetch(new URL(`music/${track}.${ext}`, document.baseURI));
        const type = res.headers.get('content-type') ?? '';
        // el servidor de desarrollo devuelve index.html (text/html) para archivos que no existen
        if (!res.ok || type.includes('text/html')) continue;
        buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
        break;
      } catch { /* sigue con la siguiente extensión */ }
    }
    this.fileCache.set(track, buf);
    return buf;
  }

  private playFile(buf: AudioBuffer, track: Track) {
    const src = this.ctx!.createBufferSource();
    src.buffer = buf;
    src.loop = SONGS[track].loop;
    src.connect(this.musicBus!);
    src.start();
    this.fileSrc = src;
  }

  // ---- síntesis ----
  private playSynth(track: Track) {
    const ctx = this.ctx!;
    const song = compile(SONGS[track], track);
    let step = 0;
    let next = ctx.currentTime + 0.06;
    const tick = () => {
      while (next < ctx.currentTime + 0.18) {
        for (const v of song.voices) {
          const ev = v.byStep.get(step);
          if (ev) this.note(v, ev, next, song.stepSec);
        }
        step++;
        next += song.stepSec;
        if (step >= song.total) {
          if (!song.loop) { window.clearInterval(this.timer!); this.timer = null; return; }
          step = 0;
        }
      }
    };
    tick();
    this.timer = window.setInterval(tick, 25);
  }

  private note(v: Voice, ev: Ev, t: number, stepSec: number) {
    const ctx = this.ctx!;
    this.scheduled++;
    const dur = Math.max(0.04, ev.len * stepSec * 0.92);
    const g = ctx.createGain();
    g.connect(this.musicBus!);
    if (v.wave === 'drums') { this.drum(ev.drum!, t, g, v.gain); return; }
    const osc = ctx.createOscillator();
    if (v.wave === 'tri') osc.type = 'triangle';
    else osc.setPeriodicWave(this.waves[v.wave]);
    osc.frequency.value = ev.freq!;
    osc.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v.gain, t + 0.006);
    g.gain.setTargetAtTime(v.gain * 0.65, t + 0.03, 0.09);
    g.gain.setTargetAtTime(0, t + dur, 0.02);
    osc.start(t);
    osc.stop(t + dur + 0.12);
  }

  private drum(kind: string, t: number, out: GainNode, gain: number) {
    const ctx = this.ctx!;
    if (kind === 'k') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      out.gain.setValueAtTime(gain * 1.2, t);
      out.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(out);
      o.start(t);
      o.stop(t + 0.18);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = kind === 's' ? 1500 : 7000;
    const len = kind === 's' ? 0.13 : 0.04;
    out.gain.setValueAtTime(gain * (kind === 's' ? 0.9 : 0.35), t);
    out.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(out);
    src.start(t);
    src.stop(t + len + 0.02);
  }
}

export const music = new MusicPlayer();
