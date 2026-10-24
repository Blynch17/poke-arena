// Efectos de sonido sintetizados con Web Audio (osciladores y ruido filtrado), sin archivos de audio.
// Se enrutan por el bus de efectos de music.ts, así que comparten el volumen general y la tecla M.

import { music } from './music';

type Audio = NonNullable<ReturnType<typeof music.audio>>;
type Wave = OscillatorType;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const EXT = ['mp3', 'ogg', 'm4a', 'wav'];

/** Sonidos de golpe recibido que pueden venir de archivos locales (public/sfx/). */
type HitCase = 'weak' | 'normal' | 'super';
const HIT_ORDER: HitCase[] = ['weak', 'normal', 'super']; // orden de los 3 sonidos en un archivo único

/**
 * Parte un audio en sus sonidos separados por silencios. Mide la energía cada 5 ms, une los huecos
 * de menos de 90 ms (el final de un sonido no se corta) y descarta lo muy corto (clics o ruido).
 */
export function splitBySilence(ctx: BaseAudioContext, buf: AudioBuffer): AudioBuffer[] {
  const win = Math.max(1, Math.floor(buf.sampleRate * 0.005));
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const n = Math.floor(buf.length / win);
  const rms: number[] = [];
  let peak = 0;
  for (let w = 0; w < n; w++) {
    let sum = 0;
    for (const ch of chans) for (let i = w * win; i < (w + 1) * win; i++) sum += ch[i] * ch[i];
    const v = Math.sqrt(sum / (win * chans.length));
    rms.push(v);
    peak = Math.max(peak, v);
  }
  const thr = Math.max(0.004, peak * 0.05);
  const gap = Math.ceil(0.09 / 0.005), minLen = Math.ceil(0.05 / 0.005);
  const runs: [number, number][] = [];
  let start = -1, quiet = 0;
  for (let w = 0; w < n; w++) {
    if (rms[w] >= thr) {
      if (start < 0) start = w;
      quiet = 0;
    } else if (start >= 0 && ++quiet > gap) {
      runs.push([start, w - quiet + 1]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, n - quiet]);
  const pre = Math.floor(buf.sampleRate * 0.01), post = Math.floor(buf.sampleRate * 0.03);
  return runs.filter(([a, b]) => b - a >= minLen).map(([a, b]) => {
    const from = Math.max(0, a * win - pre), to = Math.min(buf.length, b * win + post);
    const out = ctx.createBuffer(buf.numberOfChannels, to - from, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(chans[c].subarray(from, to), c);
    return out;
  });
}

class Sfx {
  private a: Audio | null = null;
  private dest: AudioNode | null = null;
  private clips: Partial<Record<HitCase, AudioBuffer>> = {};
  private loading: 'idle' | 'busy' | 'done' = 'idle';
  info = ''; // qué se cargó (para depurar)

  /**
   * Busca sonidos de golpe en archivos locales: hit-weak/hit-normal/hit-super (uno por caso) o hits (un solo
   * archivo con los 3 en ese orden, separados por silencios). Se llama en cada escena hasta que el audio esté listo.
   */
  async preload() {
    if (this.loading !== 'idle') return;
    const audio = music.audio();
    if (!audio) return;
    this.loading = 'busy';
    const get = async (name: string): Promise<AudioBuffer | null> => {
      for (const ext of EXT) {
        try {
          const res = await fetch(new URL(`sfx/${name}.${ext}`, document.baseURI));
          // el servidor de desarrollo devuelve index.html (text/html) para archivos que no existen
          if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) continue;
          return await audio.ctx.decodeAudioData(await res.arrayBuffer());
        } catch { /* sigue con la siguiente extensión */ }
      }
      return null;
    };
    const parts: Partial<Record<HitCase, AudioBuffer>> = {};
    for (const k of HIT_ORDER) {
      const b = await get(`hit-${k}`);
      if (b) parts[k] = b;
    }
    if (!Object.keys(parts).length) {
      const all = await get('hits');
      if (all) {
        const segs = splitBySilence(audio.ctx, all);
        if (segs.length === HIT_ORDER.length) HIT_ORDER.forEach((k, i) => (parts[k] = segs[i]));
        else console.warn(`[sfx] sfx/hits: se esperaban 3 sonidos separados por silencio y se encontraron ${segs.length}`);
      }
    }
    this.clips = parts;
    this.info = HIT_ORDER.filter((k) => parts[k]).map((k) => `${k} ${parts[k]!.duration.toFixed(2)}s`).join(', ');
    this.loading = 'done';
  }

  private playClip(buf: AudioBuffer, t: number, gain = 1) {
    const src = this.a!.ctx.createBufferSource(), g = this.a!.ctx.createGain();
    src.buffer = buf;
    g.gain.value = gain;
    src.connect(g).connect(this.dest!);
    src.start(t);
  }

  /** Prepara el audio y el paneo estéreo según la posición en la arena (x de 0 a 960). */
  private begin(x = 480): number | null {
    this.a = music.audio();
    if (!this.a) return null;
    const pan = this.a.ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.6, Math.min(0.6, ((x - 480) / 480) * 0.6));
    pan.connect(this.a.out);
    this.dest = pan;
    return this.a.ctx.currentTime;
  }

  /** Tono con barrido de frecuencia y envolvente de ataque rápido y caída exponencial. */
  private tone(t: number, f0: number, f1: number, dur: number, type: Wave, peak: number, vib = 0) {
    const { ctx } = this.a!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 9;
      lg.gain.value = vib;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.012, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.dest!);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  /** Ráfaga de ruido filtrado con barrido del filtro. */
  private noise(t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, peak: number, q = 1) {
    const { ctx, noise } = this.a!;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.dest!);
    src.start(t, rnd(0, 0.5));
    src.stop(t + dur + 0.03);
  }

  /** Sonido al lanzar un ataque. fx es el efecto visual del ataque (ver fx.ts). */
  cast(fx: string, x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    switch (fx) {
      case 'ember':
        this.noise(t, 0.28, 'bandpass', 1400, 500, 0.6, 1.2);
        this.tone(t, 330, 160, 0.12, 'square', 0.18);
        break;
      case 'flame': // chorro de fuego: rugido largo con crepitar
        this.noise(t, 1.0, 'lowpass', 500, 2400, 0.7, 0.8);
        this.noise(t + 0.4, 0.6, 'lowpass', 2400, 600, 0.55, 0.8);
        this.tone(t, 110, 70, 0.9, 'sawtooth', 0.22);
        for (let i = 0; i < 9; i++) this.noise(t + rnd(0, 0.9), 0.03, 'highpass', 4000, 3000, 0.35);
        break;
      case 'water':
        for (let i = 0; i < 3; i++) this.tone(t + i * 0.05, rnd(500, 800), rnd(1100, 1600), 0.09, 'sine', 0.3);
        this.noise(t, 0.2, 'highpass', 3500, 6000, 0.25);
        break;
      case 'hydro': // chorro de agua: oleaje grave con espuma
        this.noise(t, 1.0, 'bandpass', 500, 1200, 0.75, 0.6);
        this.noise(t + 0.3, 0.7, 'highpass', 2500, 5500, 0.35);
        this.tone(t, 90, 60, 0.9, 'sine', 0.45);
        for (let i = 0; i < 6; i++) this.tone(t + rnd(0, 0.8), rnd(400, 700), rnd(900, 1400), 0.07, 'sine', 0.18);
        break;
      case 'ice':
        this.tone(t, 2000, 2000, 0.3, 'sine', 0.3);
        this.tone(t + 0.04, 2700, 2700, 0.28, 'sine', 0.22);
        this.tone(t + 0.09, 3300, 3300, 0.25, 'sine', 0.15);
        this.noise(t, 0.12, 'highpass', 6500, 8500, 0.25);
        break;
      case 'leaf':
        this.noise(t, 0.16, 'bandpass', 3200, 1300, 0.55, 2);
        this.noise(t + 0.08, 0.16, 'bandpass', 3000, 1200, 0.45, 2);
        break;
      case 'solar': // carga que sube y luego zumbido del haz
        this.tone(t, 180, 1500, 0.45, 'square', 0.2);
        this.tone(t + 0.4, 440, 440, 0.7, 'triangle', 0.35, 14);
        this.tone(t + 0.4, 884, 884, 0.7, 'sine', 0.15, 14);
        this.noise(t + 0.4, 0.7, 'bandpass', 2200, 2600, 0.2, 3);
        break;
      case 'sludge':
        this.tone(t, 320, 80, 0.22, 'sine', 0.5);
        this.tone(t + 0.07, 260, 70, 0.2, 'sine', 0.3);
        this.noise(t, 0.2, 'lowpass', 900, 250, 0.45);
        break;
      case 'spark':
        this.tone(t, 2000, 600, 0.12, 'square', 0.2);
        this.noise(t, 0.08, 'highpass', 5000, 7000, 0.35);
        break;
      case 'bolt':
        this.tone(t, 1100, 160, 0.4, 'sawtooth', 0.22);
        for (let i = 0; i < 8; i++) this.noise(t + i * 0.045, 0.03, 'highpass', 3500, 2500, 0.45);
        break;
      case 'thunder': // relámpago: chasquido y estruendo
        this.noise(t, 0.08, 'highpass', 5000, 6000, 0.9);
        this.noise(t + 0.03, 0.7, 'lowpass', 1800, 150, 0.9);
        this.tone(t + 0.03, 130, 35, 0.7, 'sawtooth', 0.35);
        for (let i = 0; i < 5; i++) this.noise(t + i * 0.06, 0.03, 'highpass', 3000, 2500, 0.5);
        break;
      case 'psy':
        this.tone(t, 420, 900, 0.4, 'sine', 0.3, 18);
        this.tone(t, 424, 910, 0.4, 'sine', 0.22, 18);
        break;
      case 'psychic':
        this.tone(t, 300, 720, 0.55, 'sine', 0.32, 22);
        this.tone(t + 0.06, 600, 1200, 0.45, 'triangle', 0.18, 22);
        this.tone(t, 304, 730, 0.55, 'sine', 0.25, 22);
        break;
      case 'shadow':
        this.tone(t, 150, 60, 0.5, 'sawtooth', 0.28);
        this.noise(t, 0.45, 'lowpass', 900, 200, 0.5);
        this.tone(t + 0.1, 90, 50, 0.4, 'sine', 0.4);
        break;
      case 'wing': // embestida aérea: silbido que sube
        this.noise(t, 0.3, 'bandpass', 500, 2800, 0.6, 1.5);
        this.tone(t, 300, 900, 0.22, 'sine', 0.12);
        break;
      case 'lick':
        this.tone(t, 650, 300, 0.12, 'sine', 0.35);
        this.tone(t + 0.1, 300, 520, 0.12, 'sine', 0.3);
        this.noise(t, 0.2, 'bandpass', 1500, 900, 0.3, 2);
        break;
      case 'fairy': // destellos tintineantes que suben
        [1200, 1600, 2000, 2600].forEach((f, i) => this.tone(t + i * 0.06, f, f * 1.04, 0.22, 'sine', 0.22));
        this.tone(t, 600, 1800, 0.35, 'triangle', 0.16, 12);
        break;
      case 'punch': // puñetazo: silbido corto y golpe grave
        this.noise(t, 0.12, 'bandpass', 600, 1700, 0.5, 1.2);
        this.tone(t + 0.03, 170, 70, 0.12, 'sine', 0.5);
        break;
      case 'steel': // choque metálico: armónicos que no encajan y decaen rápido
        this.tone(t, 1800, 1800, 0.3, 'square', 0.12);
        this.tone(t, 2430, 2430, 0.26, 'sine', 0.2);
        this.tone(t, 3100, 3100, 0.2, 'sine', 0.14);
        this.noise(t, 0.05, 'highpass', 5000, 7000, 0.4);
        break;
      case 'earth': // retumbo con piedras que caen
        this.noise(t, 0.7, 'lowpass', 450, 140, 0.8, 0.8);
        this.tone(t, 75, 38, 0.7, 'sine', 0.6);
        for (let i = 0; i < 6; i++) this.noise(t + rnd(0.1, 0.6), 0.05, 'lowpass', 1200, 400, 0.3);
        break;
      case 'rock': // golpe seco y chasquido de roca
        this.tone(t, 130, 60, 0.2, 'sine', 0.55);
        this.noise(t, 0.25, 'lowpass', 1600, 300, 0.6);
        this.noise(t + 0.05, 0.04, 'highpass', 3500, 3000, 0.35);
        break;
      case 'dragon': // rugido: gruñido grave con aire por encima
        this.tone(t, 150, 70, 0.9, 'sawtooth', 0.28, 10);
        this.tone(t, 300, 100, 0.8, 'square', 0.12, 14);
        this.noise(t, 0.9, 'lowpass', 600, 1800, 0.55, 0.8);
        break;
      case 'blizzard': // aullido de viento helado con cristales
        this.noise(t, 1.0, 'bandpass', 900, 2600, 0.6, 1.5);
        this.noise(t + 0.2, 0.7, 'highpass', 4000, 8000, 0.25);
        [2200, 2900, 3500].forEach((f, i) => this.tone(t + i * 0.12, f, f, 0.2, 'sine', 0.15));
        break;
      default: // 'slam' y cualquier otro: embestida seca
        this.noise(t, 0.2, 'bandpass', 700, 1800, 0.5, 1.2);
        this.tone(t, 200, 90, 0.12, 'sine', 0.35);
    }
  }

  /** Sonido al recibir un golpe: depende de la eficacia, del tipo del ataque y de lo fuerte que fue. */
  hit(fx: string, eff: number, crit: boolean, big: boolean, x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    const clip = eff === 0 ? undefined : this.clips[eff < 1 ? 'weak' : eff > 1 ? 'super' : 'normal'];
    if (clip) { // sonido de archivo local según la eficacia del golpe
      this.playClip(clip, t);
      return;
    }
    if (eff === 0) { // no afecta: dos "tink" metálicos suaves
      this.tone(t, 1400, 1400, 0.12, 'sine', 0.25);
      this.tone(t + 0.12, 1100, 1100, 0.14, 'sine', 0.2);
      return;
    }
    if (eff < 1) { // poco eficaz: golpe sordo y corto
      this.tone(t, 130, 70, 0.1, 'sine', 0.5);
      this.noise(t, 0.07, 'lowpass', 900, 300, 0.3);
    } else {
      this.tone(t, 190, 55, big ? 0.22 : 0.15, 'sine', big ? 1.0 : 0.8);
      this.noise(t, 0.1, 'lowpass', 3000, 500, 0.8);
      if (eff > 1) { // muy eficaz: chasquido agudo encima
        this.noise(t, 0.09, 'highpass', 3200, 5200, 0.8);
        this.tone(t, 900, 280, 0.11, 'square', 0.3);
      }
    }
    if (big) this.tone(t, 95, 35, 0.35, 'sine', 0.9);
    // un matiz del tipo de ataque
    switch (fx) {
      case 'ember': case 'flame':
        for (let i = 0; i < 4; i++) this.noise(t + i * 0.04, 0.03, 'highpass', 4000, 3000, 0.3);
        break;
      case 'water': case 'hydro': this.noise(t, 0.25, 'bandpass', 1800, 900, 0.4, 0.8); break;
      case 'spark': case 'bolt': case 'thunder': this.tone(t, 1300, 200, 0.18, 'sawtooth', 0.25); break;
      case 'ice':
        for (let i = 0; i < 3; i++) this.noise(t + i * 0.03, 0.04, 'highpass', 7000, 8000, 0.3);
        break;
      case 'psy': case 'psychic': this.tone(t, 900, 300, 0.25, 'sine', 0.25, 16); break;
      case 'fairy': this.tone(t, 1800, 2200, 0.2, 'sine', 0.22); this.tone(t + 0.05, 2400, 2800, 0.18, 'sine', 0.15); break;
      case 'steel': this.tone(t, 2000, 2000, 0.18, 'sine', 0.22); this.noise(t, 0.04, 'highpass', 6000, 7000, 0.3); break;
      case 'earth': case 'rock': this.noise(t, 0.2, 'lowpass', 900, 250, 0.4); break;
      case 'punch': this.tone(t, 140, 55, 0.15, 'sine', 0.45); break;
      case 'dragon': this.tone(t, 120, 60, 0.35, 'sawtooth', 0.28); break;
      case 'shadow': this.tone(t, 110, 55, 0.3, 'sawtooth', 0.25); break;
      case 'leaf': this.noise(t, 0.12, 'bandpass', 2600, 1400, 0.3, 2); break;
      case 'sludge': this.tone(t, 250, 70, 0.2, 'sine', 0.35); break;
    }
    if (crit) { // golpe crítico: destello agudo
      this.tone(t + 0.02, 1800, 2800, 0.2, 'triangle', 0.35);
      this.tone(t + 0.05, 2400, 3300, 0.18, 'sine', 0.22);
    }
  }

  /** Pisar hierba alta: roce corto de hojas. */
  rustle(x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    this.noise(t, 0.14, 'bandpass', 3000, 1600, 0.35, 1.2);
    this.noise(t + 0.05, 0.1, 'highpass', 4500, 3500, 0.2);
  }

  /** Aparece un Pokémon salvaje: alarma que sube en tres golpes. */
  encounter(x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    [330, 440, 660].forEach((f, i) => this.tone(t + i * 0.13, f, f * 1.5, 0.16, 'square', 0.22));
    this.noise(t + 0.4, 0.25, 'bandpass', 800, 3000, 0.4, 1);
  }

  /** Lanzar la bola: silbido corto. */
  throwBall(x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    this.noise(t, 0.22, 'bandpass', 700, 2200, 0.45, 1.5);
    this.tone(t, 380, 760, 0.16, 'sine', 0.14);
  }

  /** El Pokémon entra en la bola: barrido agudo que se apaga. */
  absorb(x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    this.tone(t, 1800, 300, 0.4, 'sine', 0.25, 10);
    this.noise(t, 0.3, 'highpass', 3000, 7000, 0.25);
  }

  /** Cada sacudida de la bola: golpecito sordo con un clic encima. */
  ballShake(x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    this.tone(t, 220, 120, 0.11, 'sine', 0.55);
    this.noise(t, 0.03, 'highpass', 3500, 3000, 0.4);
  }

  /** Captura lograda: clic seco y arpegio alegre. */
  captured(x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    this.noise(t, 0.03, 'highpass', 4000, 3500, 0.6);
    [523, 659, 784, 1047].forEach((f, i) => this.tone(t + 0.12 + i * 0.1, f, f, 0.22, 'square', 0.16));
    this.tone(t + 0.55, 1568, 1568, 0.5, 'sine', 0.22);
  }

  /** El Pokémon se libera: la bola se abre con un estallido. */
  escaped(x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    this.noise(t, 0.2, 'bandpass', 900, 3500, 0.7, 1);
    this.tone(t, 700, 180, 0.3, 'sawtooth', 0.2);
  }

  /** Mejora de stats: arpegio ascendente. */
  boost(x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    [392, 494, 587, 784].forEach((f, i) => this.tone(t + i * 0.07, f, f, 0.16, 'square', 0.16));
    this.tone(t + 0.28, 1568, 1568, 0.3, 'sine', 0.2);
  }

  /** Un Pokémon se debilita: tono que cae. */
  faint(x?: number) {
    const t = this.begin(x);
    if (t === null) return;
    this.tone(t, 520, 70, 0.7, 'square', 0.22);
    this.tone(t, 260, 40, 0.8, 'triangle', 0.4);
  }
}

export const sfx = new Sfx();
