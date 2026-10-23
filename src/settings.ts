// Ajustes del jugador, guardados en el navegador (localStorage).

export type Controls = 'keys' | 'mouse';

export interface Settings {
  music: number;      // volumen de la música, de 0 a 10
  sfx: number;        // volumen de los efectos de sonido, de 0 a 10
  controls: Controls; // keys: WASD mover + UIOP atacar · mouse: clic para mover + QWER atacar apuntando al cursor
}

const STORAGE_KEY = 'pokeArenaSettings';
const vol = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : 10);

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<Settings>;
      return { music: vol(o.music), sfx: vol(o.sfx), controls: o.controls === 'mouse' ? 'mouse' : 'keys' };
    }
  } catch { /* sin almacenamiento o datos dañados: se usan los valores por defecto */ }
  return { music: 10, sfx: 10, controls: 'keys' };
}

export const settings: Settings = load();

export function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* sin almacenamiento */ }
}
