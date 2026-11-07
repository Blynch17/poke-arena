// Piezas de interfaz del equipo, compartidas por el menú de batalla y el del mundo: tarjetas de Pokémon con su imagen,
// nivel y PS, y el panel de "datos" con sus ataques y los PP que le quedan a cada uno.

import Phaser from 'phaser';
import { PokemonDef, Stats, TYPE_COLOR, maxUses } from './data';
import { STATUS_INFO } from './status';

export interface Entry {
  def: PokemonDef;
  level: number;
  hp: number;
  maxHp: number;
  stats: Stats;
  pp: number[];       // usos que le quedan a cada ataque
  tag?: string;       // texto extra a la derecha (por ejemplo "en combate")
}

type Obj = Phaser.GameObjects.GameObject;

const hpColor = (f: number) => (f > 0.5 ? 0x4fd14f : f > 0.2 ? 0xffd23f : 0xe84a4a);

/** Tamaño de las tarjetas según cuántos Pokémon hay: con 4 o más se compactan para que quepan hasta 6 en pantalla. */
export function cardMetrics(n: number) { return n <= 3 ? { h: 84, gap: 10, compact: false } : { h: 60, gap: 6, compact: true }; }

/** Una tarjeta por Pokémon: imagen, nombre, nivel, barra y número de PS. `mark` resalta otra tarjeta (la que se está moviendo). */
export function teamCards(
  scene: Phaser.Scene, entries: Entry[], sel: number, cx: number, top: number, w = 560, mark = -1,
): Obj[] {
  const out: Obj[] = [];
  const { h: CARD_H, gap: CARD_GAP, compact } = cardMetrics(entries.length);
  entries.forEach((e, i) => {
    const y = top + i * (CARD_H + CARD_GAP) + CARD_H / 2, left = cx - w / 2;
    const faint = e.hp <= 0;
    const stroke = i === sel ? 0xffd23f : i === mark ? 0x7fc4ff : 0x3f5c48;
    out.push(scene.add.rectangle(cx, y, w, CARD_H, faint ? 0x2a2a2a : 0x24382a).setStrokeStyle(compact ? 3 : 4, stroke));
    const f = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
    if (compact) {   // una sola fila de dos líneas: nombre y nivel arriba, barra y PS abajo
      out.push(scene.add.text(left + 10, y - 22, `${i + 1}`, { fontSize: '14px', color: '#ffd23f', fontStyle: 'bold' }));
      if (scene.textures.exists(`${e.def.id}-front`)) out.push(scene.add.image(left + 46, y, `${e.def.id}-front`).setScale(0.5).setAlpha(faint ? 0.4 : 1));
      out.push(scene.add.text(left + 88, y - 24, e.def.name, { fontSize: '17px', color: faint ? '#888' : '#fff', fontStyle: 'bold' }));
      const note = faint ? 'debilitado' : e.tag ?? '';
      out.push(scene.add.text(left + w - 12, y - 23, `${note ? note + ' · ' : ''}Nv.${e.level}`, { fontSize: '14px', color: faint ? '#ff8888' : '#cfe8cf' }).setOrigin(1, 0));
      const bx = left + 88, bw = w - 88 - 130, by = y + 2;
      out.push(scene.add.rectangle(bx + bw / 2, by + 6, bw + 4, 14, 0x000000, 0.65));
      out.push(scene.add.rectangle(bx, by, Math.max(0.01, bw * f), 10, hpColor(f)).setOrigin(0, 0));
      out.push(scene.add.text(left + w - 12, by - 2, `PS ${Math.ceil(e.hp)}/${e.maxHp}`, { fontSize: '14px', color: '#cfe8cf' }).setOrigin(1, 0));
      return;
    }
    out.push(scene.add.text(left + 14, y - 30, `${i + 1}`, { fontSize: '16px', color: '#ffd23f', fontStyle: 'bold' }));
    if (scene.textures.exists(`${e.def.id}-front`)) out.push(scene.add.image(left + 62, y, `${e.def.id}-front`).setScale(0.7).setAlpha(faint ? 0.4 : 1));
    out.push(scene.add.text(left + 122, y - 32, e.def.name, { fontSize: '20px', color: faint ? '#888' : '#fff', fontStyle: 'bold' }));
    out.push(scene.add.text(left + w - 14, y - 32, `Nv.${e.level}`, { fontSize: '18px', color: '#cfe8cf' }).setOrigin(1, 0));
    const bw = w - 136, bx = left + 122, by = y + 2;
    out.push(scene.add.rectangle(bx + bw / 2, by + 6, bw + 4, 16, 0x000000, 0.65));
    out.push(scene.add.rectangle(bx, by, Math.max(0.01, bw * f), 12, hpColor(f)).setOrigin(0, 0));
    out.push(scene.add.text(bx, y + 22, `PS ${Math.ceil(e.hp)}/${e.maxHp}`, { fontSize: '14px', color: '#cfe8cf' }));
    if (e.tag || faint) out.push(scene.add.text(left + w - 14, y + 22, faint ? 'debilitado' : e.tag!, { fontSize: '14px', color: faint ? '#ff8888' : '#ffd23f' }).setOrigin(1, 0));
  });
  return out;
}

/** Panel de datos de un Pokémon: imagen, nivel, PS, tipos, stats y ataques con los PP que le quedan. */
export function dataPanel(scene: Phaser.Scene, e: Entry, cx: number, cy: number): Obj[] {
  const w = 760, h = 470, left = cx - w / 2, top = cy - h / 2, out: Obj[] = [];
  out.push(scene.add.rectangle(cx, cy, w, h, 0x1b2a1e).setStrokeStyle(4, 0xffd23f));
  out.push(scene.add.text(cx, top + 24, 'DATOS', { fontSize: '24px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5));
  // izquierda: imagen, nombre, tipos, PS y stats
  if (scene.textures.exists(`${e.def.id}-front`)) out.push(scene.add.image(left + 120, top + 130, `${e.def.id}-front`).setScale(1.5));
  out.push(scene.add.text(left + 120, top + 218, e.def.name, { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
  out.push(scene.add.text(left + 120, top + 246, `Nivel ${e.level}`, { fontSize: '18px', color: '#cfe8cf' }).setOrigin(0.5));
  e.def.types.forEach((t, k) => {
    const tx = left + 120 + (k - (e.def.types.length - 1) / 2) * 76;
    out.push(scene.add.rectangle(tx, top + 274, 70, 16, TYPE_COLOR[t]));
    out.push(scene.add.text(tx, top + 274, t, { fontSize: '11px', color: '#000' }).setOrigin(0.5));
  });
  const f = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
  out.push(scene.add.rectangle(left + 120, top + 304, 204, 18, 0x000000, 0.65));
  out.push(scene.add.rectangle(left + 20, top + 296, Math.max(0.01, 200 * f), 14, hpColor(f)).setOrigin(0, 0));
  out.push(scene.add.text(left + 120, top + 326, `PS ${Math.ceil(e.hp)}/${e.maxHp}`, { fontSize: '16px', color: '#fff' }).setOrigin(0.5));
  const st = e.stats;
  out.push(scene.add.text(left + 120, top + 372, `Ataque ${st.atk}   Defensa ${st.def}\nAt. Esp. ${st.spa}   Def. Esp. ${st.spd}\nVelocidad ${st.spe}`, { fontSize: '14px', color: '#9fb8a6', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0));
  // derecha: ataques
  out.push(scene.add.text(left + 270, top + 62, 'ATAQUES', { fontSize: '16px', color: '#ffd23f', fontStyle: 'bold' }));
  e.def.moves.forEach((mv, i) => {
    const y = top + 92 + i * 84, x = left + 270, mw = w - 290;
    const left_ = e.pp[i] ?? 0, max = maxUses(mv);
    out.push(scene.add.rectangle(x + mw / 2, y + 34, mw, 74, 0x24382a).setStrokeStyle(3, TYPE_COLOR[mv.type]));
    out.push(scene.add.rectangle(x + 8, y + 34, 8, 74, TYPE_COLOR[mv.type]));
    out.push(scene.add.text(x + 22, y + 8, mv.name, { fontSize: '20px', color: '#fff', fontStyle: 'bold' }));
    out.push(scene.add.text(x + mw - 12, y + 8, `PP ${left_}/${max}`, { fontSize: '20px', color: left_ <= 0 ? '#ff8888' : '#cfe8cf', fontStyle: 'bold' }).setOrigin(1, 0));
    const kind = mv.category === 'status' ? 'Estado' : mv.category === 'physical' ? 'Física' : 'Especial';
    out.push(scene.add.text(x + 22, y + 40, `${mv.type} · ${kind}${mv.power ? ` · Potencia ${mv.power}` : ''} · Prec. ${mv.accuracy ?? 100} % · Energía ${mv.cost}`, { fontSize: '14px', color: '#9fb8a6' }));
    if (mv.inflict) {   // estado que puede causar
      const w = mv.inflict.status, name = w === 'flinch' ? 'retroceso' : w === 'tri' ? 'quemar, paralizar o congelar' : STATUS_INFO[w].name.toLowerCase();
      out.push(scene.add.text(x + 22, y + 58, mv.category === 'status' ? `Causa: ${name}` : `${mv.inflict.chance} % de causar ${name}`, { fontSize: '12px', color: '#ffd23f' }));
    }
  });
  out.push(scene.add.text(cx, top + h - 20, 'ENTER o ESC para volver', { fontSize: '14px', color: '#cfe8cf' }).setOrigin(0.5));
  return out;
}
