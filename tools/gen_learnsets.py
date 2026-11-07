#!/usr/bin/env python3
"""Genera src/learnsets.ts y src/moves_gen.ts a partir de PokeAPI (https://pokeapi.co).

  python3 tools/gen_learnsets.py            # las especies que hay en el juego (151)
  python3 tools/gen_learnsets.py 1 493      # un rango de número de Pokédex (cuando se sumen más generaciones)

- learnsets.ts: por especie, qué ataque aprende en cada nivel (la lista de «Ultra Sol / Ultra Luna») y a qué nivel
  evoluciona. Las evoluciones por piedra, intercambio o felicidad no tienen nivel en los juegos: aquí se les asigna uno
  (EVO_FALLBACK) y se pueden editar a mano en el archivo generado.
- moves_gen.ts: los ataques que aprenden esas especies y que no estaban en roster.ts, con el mismo formato (costo,
  recarga y proyectil salen del poder). Se omiten los que el juego todavía no sabe hacer (curar, proteger, clima,
  bajar stats del rival...); no se pueden aprender y no aparecen en la lista.

Las respuestas de la API se guardan en una carpeta de caché (CACHE_DIR, por defecto /tmp/pokeapi-cache).
"""
import json, os, re, subprocess, sys, unicodedata
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('CACHE_DIR', '/tmp/pokeapi-cache')
VERSION_GROUPS = ['ultra-sun-ultra-moon', 'sun-moon', 'omega-ruby-alpha-sapphire', 'black-2-white-2', 'black-white', 'heartgold-soulsilver', 'diamond-pearl']
os.makedirs(CACHE, exist_ok=True)


def get(path):
    f = os.path.join(CACHE, path.replace('/', '_') + '.json')
    if os.path.exists(f):
        return json.load(open(f))
    for _ in range(4):
        try:
            # curl en vez de urllib: el Python de macOS suele no tener los certificados instalados
            data = json.loads(subprocess.run(['curl', '-sf', '-m', '30', 'https://pokeapi.co/api/v2/' + path], check=True, capture_output=True).stdout)
            json.dump(data, open(f, 'w'))
            return data
        except Exception as e:  # noqa: BLE001
            err = e
    raise RuntimeError(f'{path}: {err}')


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in s if unicodedata.category(c) != 'Mn'))


# ---------- lo que ya existe en el juego ----------
rost = open(os.path.join(ROOT, 'src/roster.ts'), encoding='utf-8').read()
data_ts = open(os.path.join(ROOT, 'src/data.ts'), encoding='utf-8').read()
existing = {}   # nombre normalizado o clave -> clave
for m in re.finditer(r"^\s{2}(\w+): \['([^']+)'", rost, re.M):
    existing[norm(m.group(2))] = m.group(1)
    existing.setdefault(norm(m.group(1)), m.group(1))
species_keys = {}   # id -> ataques de la tabla SPECIES (se usan si una especie no aprende ningún ataque utilizable)
for m in re.finditer(r"^\s*\['([a-z0-9-]+)', [\"'].+?[\"'], \d+, .*?\[((?:'\w+'(?:, )?)+)\]\],\s*$", rost, re.M):
    species_keys[m.group(1)] = re.findall(r"'(\w+)'", m.group(2))
species = {}    # dex -> id
for m in re.finditer(r"^\s*\['([a-z0-9-]+)', [\"'].+?[\"'], (\d+),", rost, re.M):
    species[int(m.group(2))] = m.group(1)
for m in re.finditer(r"(\w+): (\d+)", re.search(r"const DEX: Record<string, number> = \{(.*?)\};", data_ts, re.S).group(1)):
    species[int(m.group(2))] = m.group(1)

lo, hi = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) >= 3 else (min(species), max(species))
dexes = [d for d in range(lo, hi + 1) if (d in species) or len(sys.argv) >= 3]
sid = lambda dex, api_name: species.get(dex) or api_name.replace('-', '')  # noqa: E731

# ---------- especies ----------
def load_species(dex):
    return get(f'pokemon/{dex}'), get(f'pokemon-species/{dex}')

with ThreadPoolExecutor(8) as ex:
    loaded = dict(zip(dexes, ex.map(load_species, dexes)))

chains = {}
def chain_of(url):
    cid = url.rstrip('/').split('/')[-1]
    return get(f'evolution-chain/{cid}')
with ThreadPoolExecutor(8) as ex:
    urls = sorted({sp['evolution_chain']['url'] for _, sp in loaded.values()})
    for u, c in zip(urls, ex.map(chain_of, urls)):
        chains[u] = c

# Nivel asignado a evoluciones que en los juegos no son por nivel.
EVO_FALLBACK = {'use-item': 30, 'trade': 40, 'happiness': 32, 'other': 34}
HOW = {'level-up': 'nivel', 'use-item': 'piedra', 'trade': 'intercambio', 'happiness': 'felicidad', 'other': 'especial'}


def species_dex(url):
    return int(url.rstrip('/').split('/')[-1])


evolutions = {}
def walk(node):
    frm = species_dex(node['species']['url'])
    for nxt in node['evolves_to']:
        to = species_dex(nxt['species']['url'])
        d = nxt['evolution_details'][0] if nxt['evolution_details'] else {}
        trig = d.get('trigger', {}).get('name', 'level-up')
        if d.get('min_level'):
            how, level = 'level-up', d['min_level']
        elif trig == 'trade':
            how, level = 'trade', EVO_FALLBACK['trade']
        elif trig == 'use-item':
            how, level = 'use-item', EVO_FALLBACK['use-item']
        elif d.get('min_happiness'):
            how, level = 'happiness', EVO_FALLBACK['happiness']
        else:
            how, level = 'other', EVO_FALLBACK['other']
        if frm in loaded:
            evolutions.setdefault(frm, []).append((nxt['species']['name'], to, level, how))
        walk(nxt)
for c in chains.values():
    walk(c['chain'])

# ---------- aprendizaje por nivel ----------
learn = {}   # dex -> [(nivel, move api name)]
for dex, (poke, _) in loaded.items():
    for vg in VERSION_GROUPS:
        rows = []
        for mv in poke['moves']:
            for d in mv['version_group_details']:
                if d['version_group']['name'] == vg and d['move_learn_method']['name'] == 'level-up':
                    rows.append((max(1, d['level_learned_at']), mv['move']['name']))
        if rows:
            break
    seen, out = set(), []
    for lvl, name in sorted(rows, key=lambda r: r[0]):
        if name not in seen:
            seen.add(name)
            out.append((lvl, name))
    learn[dex] = out

# ---------- ataques ----------
move_names = sorted({n for rows in learn.values() for _, n in rows})
with ThreadPoolExecutor(8) as ex:
    mdata = dict(zip(move_names, ex.map(lambda n: get(f'move/{n}'), move_names)))

STAT = {'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe'}
STAT_DEBUFF = {**STAT, 'accuracy': 'acc'}   # lo que se puede bajar al rival (la precisión es una etapa más)
SOUND = {'growl', 'screech', 'metal-sound', 'sing', 'supersonic', 'baby-doll-eyes', 'captivate', 'charm', 'fake-tears'}   # proyectil de notas
POWDER = {'string-shot', 'cotton-spore', 'sand-attack', 'smokescreen', 'poison-gas', 'flash', 'kinesis', 'scary-face', 'leer'}   # nube
FOE_DROP_ALWAYS = {'icy-wind', 'mud-shot', 'bulldoze', 'snarl', 'struggle-bug', 'electroweb', 'mud-slap', 'low-sweep', 'rock-tomb', 'constrict'}
HEAL_SKIP = {'healing-wish', 'lunar-dance', 'memento', 'swallow', 'wish', 'heal-pulse', 'life-dew'}
AIL = {'sleep': 'sleep', 'paralysis': 'paralysis', 'poison': 'poison', 'burn': 'burn', 'confusion': 'confusion'}
FX_DASH = {'normal': 'slam', 'fire': 'ember', 'water': 'water', 'grass': 'leaf', 'electric': 'spark', 'ice': 'ice', 'fighting': 'punch',
           'poison': 'sludge', 'ground': 'earth', 'flying': 'wing', 'psychic': 'psy', 'bug': 'bug', 'rock': 'rock', 'ghost': 'shadow',
           'dragon': 'dragon', 'dark': 'dark', 'steel': 'steel', 'fairy': 'fairy'}
FX_PROJ = {'normal': 'star', 'fire': 'ember', 'water': 'jet', 'grass': 'leaf', 'electric': 'zap', 'ice': 'icebeam', 'fighting': 'star',
           'poison': 'toxic', 'ground': 'bone', 'flying': 'tornado', 'psychic': 'psy', 'bug': 'buzz', 'rock': 'rock', 'ghost': 'ghost',
           'dragon': 'dragonbreath', 'dark': 'darkbeam', 'steel': 'flash', 'fairy': 'gleam'}
SKIP = {'memento', 'counter', 'mirror-coat', 'bide', 'metal-burst', 'endeavor', 'final-gambit', 'struggle', 'sky-drop', 'beat-up', 'spit-up'}
EMPTY_FALLBACK = {'abra': 'confusion'}   # el primer ataque de la tabla de roster.ts sería demasiado fuerte para Abra
VARIABLE = 60   # poder asignado a los ataques de poder variable o daño fijo

def es_name(m):
    for n in m['names']:
        if n['language']['name'] == 'es':
            return n['name']
    return m['names'][0]['name'] if m['names'] else m['name']

key_of = {}            # api name -> clave en el juego
new_moves, new_boosts, new_status, new_inflict, new_acc = {}, {}, {}, {}, {}
new_debuffs, new_heals, new_drain, new_drops = {}, {}, {}, {}


def debuff_dict(changes):
    """stat_changes de PokeAPI -> texto TS `{ atk: -1, acc: -1 }` si todos son bajadas de stats; si no, None."""
    if not changes or not all(c['stat']['name'] in STAT_DEBUFF and c['change'] < 0 for c in changes):
        return None
    return '{ ' + ', '.join('%s: %d' % (STAT_DEBUFF[c['stat']['name']], c['change']) for c in changes) + ' }'

skipped = []
for name, m in mdata.items():
    es = es_name(m)
    if norm(es) in existing:
        key_of[name] = existing[norm(es)]
        continue
    if norm(name) in existing:
        key_of[name] = existing[norm(name)]
        continue
    if name in SKIP:
        skipped.append(name); continue
    key = norm(name)
    typ, cls = m['type']['name'], m['damage_class']['name']
    meta = m.get('meta') or {}
    ail = AIL.get((meta.get('ailment') or {}).get('name'))
    tox = (meta.get('ailment') or {}).get('name') == 'poison' and name in ('toxic',)
    pp = m['pp'] or 10
    acc = m['accuracy']
    target = m['target']['name']
    if cls != 'status':
        power = m['power']
        if power is None:
            power = 130 if (meta.get('category') or {}).get('name') == 'ohko' else VARIABLE
            if (meta.get('category') or {}).get('name') == 'ohko':
                acc = 30
        if power <= 0:
            skipped.append(name); continue
        area = target in ('all-opponents', 'all-other-pokemon')
        shape = 'n' if area else ('d' if cls == 'physical' else 'p')
        fx = FX_PROJ[typ] if (shape == 'p' or area) else FX_DASH[typ]
        extra = ', { range: 230 }' if area else ''
        new_moves[key] = f"['{es}', '{typ}', '{cls}', {power}, {pp}, '{fx}', '{shape}'{extra}]"
        chance = meta.get('ailment_chance') or 0
        if ail and chance:
            new_inflict[es] = (ail, chance)
        elif meta.get('flinch_chance'):
            new_inflict[es] = ('flinch', meta['flinch_chance'])
        if acc and acc < 100:
            new_acc[es] = acc
        if (meta.get('drain') or 0) > 0:
            new_drain[es] = meta['drain'] / 100
        dd = debuff_dict(m.get('stat_changes'))
        stat_chance = meta.get('stat_chance') or 0
        if dd and target in ('selected-pokemon', 'random-opponent', 'all-opponents', 'all-other-pokemon') and (stat_chance > 0 or name in FOE_DROP_ALWAYS):
            new_drops[es] = (dd, stat_chance or 100)
        key_of[name] = key
        continue
    changes = m.get('stat_changes') or []
    if target == 'user' and ((meta.get('healing') or 0) > 0 or name == 'rest') and name not in HEAL_SKIP and not changes:
        new_heals[key] = f"['{es}', '{typ}', {pp}, {1.0 if name == 'rest' else meta['healing'] / 100}]"
        key_of[name] = key
        continue
    dd = debuff_dict(changes)
    if dd and target != 'user' and not m.get('power'):
        fx = 'note' if name in SOUND else 'cone' if name in POWDER else FX_PROJ[typ]
        new_debuffs[key] = f"['{es}', '{typ}', {pp}, '{fx}', {dd}]"
        if acc and acc < 100:
            new_acc[es] = acc
        key_of[name] = key
        continue
    if target == 'user' and changes and all(c['stat']['name'] in STAT and c['change'] > 0 for c in changes) and not m.get('power'):
        boost = ', '.join(f"{STAT[c['stat']['name']]}: {c['change']}" for c in changes)
        new_boosts[key] = f"['{es}', '{typ}', {pp}, {{ {boost} }}]"
        key_of[name] = key
        continue
    if ail and target in ('selected-pokemon', 'all-opponents', 'all-other-pokemon', 'random-opponent'):
        status = 'toxic' if tox else ail
        new_status[key] = f"['{es}', '{typ}', {pp}, '{FX_PROJ[typ]}', '{status}']"
        if acc and acc < 100:
            new_acc[es] = acc
        key_of[name] = key
        continue
    skipped.append(name)

# ---------- salida ----------
def esc(s): return s.replace("'", "\\'")

lines = ['// GENERADO por tools/gen_learnsets.py. No editar a mano (se vuelve a generar); para cambiar un ataque, edita roster.ts.', '',
         "import type { PType, Category, Stages, Debuff } from './data';", "import type { StatusId, Inflict } from './status';", '']
lines += ['/** Mismo formato que `MOVES` de roster.ts (ver ahí). Se agregan al catálogo al cargar roster.ts. */',
          'export const GEN_MOVES: Record<string, [string, PType, Category, number, number, string, \'p\' | \'d\' | \'n\', { range?: number }?]> = {']
lines += [f"  {k}: {v}," for k, v in sorted(new_moves.items())] + ['};', '']
lines += ['export const GEN_BOOSTS: Record<string, [string, PType, number, Partial<Stages>]> = {'] + [f"  {k}: {v}," for k, v in sorted(new_boosts.items())] + ['};', '']
lines += ['export const GEN_STATUS: Record<string, [string, PType, number, string, StatusId]> = {'] + [f"  {k}: {v}," for k, v in sorted(new_status.items())] + ['};', '']
lines += ['export const GEN_INFLICT: Record<string, [Inflict[\'status\'], number]> = {'] + [f"  \"{k}\": ['{a}', {b}]," for k, (a, b) in sorted(new_inflict.items())] + ['};', '']
lines += ['export const GEN_DEBUFFS: Record<string, [string, PType, number, string, Debuff]> = {'] + [f"  {k}: {v}," for k, v in sorted(new_debuffs.items())] + ['};', '']
lines += ['export const GEN_HEALS: Record<string, [string, PType, number, number]> = {'] + [f"  {k}: {v}," for k, v in sorted(new_heals.items())] + ['};', '']
lines += ['export const GEN_DRAIN: Record<string, number> = {'] + [f"  \"{k}\": {v}," for k, v in sorted(new_drain.items())] + ['};', '']
lines += ['export const GEN_DROPS: Record<string, [Debuff, number]> = {'] + [f"  \"{k}\": [{a}, {b}]," for k, (a, b) in sorted(new_drops.items())] + ['};', '']
lines += ['export const GEN_ACCURACY: Record<string, number> = {'] + [f"  \"{k}\": {v}," for k, v in sorted(new_acc.items())] + ['};', '']
open(os.path.join(ROOT, 'src/moves_gen.ts'), 'w', encoding='utf-8').write('\n'.join(lines))

L = ['// GENERADO por tools/gen_learnsets.py a partir de PokeAPI. Los ataques por nivel son los de Ultra Sol / Ultra Luna;',
     '// las evoluciones que en los juegos no son por nivel (piedra, intercambio, felicidad) tienen aquí un nivel asignado',
     '// (EVO_FALLBACK en el generador): se pueden editar a mano.', '',
     '/** Ataques que aprende cada especie: [nivel, clave del ataque]. Los de nivel 1 los sabe de entrada. */',
     'export const LEARNSETS: Record<string, [number, string][]> = {']
for dex in dexes:
    rows = [(l, key_of[n]) for l, n in learn[dex] if n in key_of]
    if not rows:   # solo aprende ataques que el juego no sabe hacer (Abra: Teletransporte): se le da uno de arranque
        sid_ = sid(dex, loaded[dex][0]['name'])
        rows = [(1, EMPTY_FALLBACK.get(sid_) or species_keys.get(sid_, ['tackle'])[0])]
    body = ', '.join('[%d, "%s"]' % (l, k) for l, k in rows)
    L.append("  '%s': [%s]," % (sid(dex, loaded[dex][0]['name']), body))
L += ['};', '',
      '/** A qué evoluciona cada especie y en qué nivel (`how`: cómo evoluciona en los juegos). */',
      'export const EVOLUTIONS: Record<string, { to: string; level: number; how: string }[]> = {']
for dex in dexes:
    if dex in evolutions:
        body = ', '.join("{ to: '%s', level: %d, how: '%s' }" % (sid(to, nm), lv, HOW[how]) for nm, to, lv, how in evolutions[dex])
        L.append("  '%s': [%s]," % (sid(dex, loaded[dex][0]['name']), body))
L += ['};', '']
open(os.path.join(ROOT, 'src/learnsets.ts'), 'w', encoding='utf-8').write('\n'.join(L))

print(f'{len(dexes)} especies, {len(move_names)} ataques distintos: {len(new_moves)} de daño, {len(new_boosts)} de mejora, '
      f'{len(new_status)} de estado, {len(new_debuffs)} que bajan stats, {len(new_heals)} que curan nuevos; '
      f'{len(new_drain)} con absorción, {len(new_drops)} con bajada secundaria; {len(skipped)} omitidos')
print('omitidos:', ', '.join(sorted(skipped)))
