# Cómo agregar un Pokémon al juego

El juego ya soporta más de 6 combatientes: la selección de equipo es una cuadrícula que se ordena por número de
Pokédex, y están los 18 tipos con su tabla de efectividad. Para sumar uno hacen falta tres cosas.

## 1. Los sprites, en `public/sprites/` (nombres en minúscula)
| Archivo | Medida | Para qué |
|---|---|---|
| `<id>-front.png` | 96×96 | retrato de la pantalla de selección |
| `<id>-back.png` | 96×96 | se carga, pero hoy no se usa |
| `<id>-walk.png` | 64×128 | hoja de caminata: 2 cuadros por fila; filas = abajo, arriba, izquierda, derecha |

`<id>` es el nombre en minúscula y sin tildes (por ejemplo `machamp`). **En GitHub Pages las mayúsculas importan**,
así que `Machamp-walk.png` no se encontraría: debe ser `machamp-walk.png`.

## 2. El número de Pokédex, en `src/data.ts`
Agrega una línea al objeto `DEX`, por ejemplo `machamp: 68,`.

## 3. La entrada en la lista `RAW` de `src/data.ts`
Las entradas de abajo usan los ayudantes que ya existen en ese archivo (`mv` para ataques de daño y `st` para los de
mejora de stats). El orden de los 4 ataques es el de las teclas U, I, O, P (o Q, W, E, R con mouse).
Los movimientos están verificados en [Pokémon Database](https://pokemondb.net) (Escarlata/Púrpura y Leyendas: Z-A).

Parámetros de `mv`: nombre, tipo, categoría, poder, PP, costo de energía, recarga (ms), velocidad del proyectil,
vida del proyectil (ms), tamaño, efecto visual y, opcionalmente, `{ style: 'dash', dash: px }` para embestidas.

```ts
  {
    id: 'wigglytuff', name: 'Wigglytuff', types: ['normal', 'fairy'],
    base: { hp: 140, atk: 70, def: 45, spa: 85, spd: 50, spe: 45 },
    moves: [
      mv('Voz Cautivadora', 'fairy', 'special', 40, 15, 22, 1100, 520, 800, 0.8, 'fairy'),
      mv('Golpe Cuerpo', 'normal', 'physical', 85, 15, 40, 2300, 0, 0, 1, 'slam', { style: 'dash', dash: 240 }),
      mv('Fuerza Lunar', 'fairy', 'special', 95, 15, 43, 2600, 420, 1000, 1.3, 'fairy'),
      st('Paz Mental', 'psychic', 20, STATUS_COST, { spa: 1, spd: 1 }),
    ],
  },
  {
    id: 'machamp', name: 'Machamp', types: ['fighting'],
    base: { hp: 90, atk: 130, def: 80, spa: 65, spd: 85, spe: 55 },
    moves: [
      mv('Puño Bala', 'steel', 'physical', 40, 30, 22, 1100, 0, 0, 1, 'steel', { style: 'dash', dash: 200 }),
      mv('Demolición', 'fighting', 'physical', 75, 15, 36, 2000, 0, 0, 1, 'punch', { style: 'dash', dash: 230 }),
      mv('Puño Dinámico', 'fighting', 'physical', 100, 5, 46, 2800, 0, 0, 1, 'punch', { style: 'dash', dash: 260 }),
      st('Corpulencia', 'fighting', 20, STATUS_COST, { atk: 1, def: 1 }),
    ],
  },
  {
    id: 'golem', name: 'Golem', types: ['rock', 'ground'],
    base: { hp: 80, atk: 120, def: 130, spa: 55, spd: 65, spe: 45 },
    moves: [
      mv('Lanzarrocas', 'rock', 'physical', 50, 15, 26, 1300, 520, 800, 0.9, 'rock'),
      mv('Avalancha', 'rock', 'physical', 75, 10, 36, 2000, 480, 900, 1.2, 'rock'),
      mv('Terremoto', 'ground', 'physical', 100, 10, 46, 2800, 380, 1000, 1.4, 'earth'),
      st('Defensa Férrea', 'steel', 15, STATUS_COST, { def: 2 }),
    ],
  },
  {
    id: 'lapras', name: 'Lapras', types: ['water', 'ice'],
    base: { hp: 130, atk: 85, def: 80, spa: 85, spd: 95, spe: 60 },
    moves: [
      mv('Canto Helado', 'ice', 'physical', 40, 30, 22, 1000, 640, 700, 0.8, 'ice'),
      mv('Surf', 'water', 'special', 90, 15, 42, 2500, 420, 1000, 1.3, 'hydro'),
      mv('Rayo Hielo', 'ice', 'special', 90, 10, 42, 2500, 560, 900, 0.9, 'ice'),
      mv('Ventisca', 'ice', 'special', 110, 5, 49, 3000, 420, 1000, 1.3, 'blizzard'),
    ],
  },
  {
    id: 'dragonite', name: 'Dragonite', types: ['dragon', 'flying'],
    base: { hp: 91, atk: 134, def: 95, spa: 100, spd: 100, spe: 80 },
    moves: [
      mv('Ataque Ala', 'flying', 'physical', 60, 35, 31, 1700, 0, 0, 1, 'wing', { style: 'dash', dash: 230 }),
      mv('Garra Dragón', 'dragon', 'physical', 80, 15, 38, 2200, 0, 0, 1, 'dragon', { style: 'dash', dash: 250 }),
      mv('Pulso Dragón', 'dragon', 'special', 85, 10, 40, 2400, 420, 1000, 1.3, 'dragon'),
      st('Danza Dragón', 'dragon', 20, STATUS_COST, { atk: 1, spe: 1 }),
    ],
  },
```

Números de Pokédex para el objeto `DEX`: `wigglytuff: 40, machamp: 68, golem: 76, lapras: 131, dragonite: 149,`

## 4. Índice de captura (opcional)
Para que el Pokémon también pueda aparecer como salvaje con su dificultad real, agrega su índice de captura al objeto
`CATCH` de `src/data.ts` (por ejemplo `machamp: 45,`). Si falta, se usa 45. Se consulta en Pokémon Database.

## Efectos visuales disponibles (último parámetro de `mv`)
Proyectiles: `ember`, `water`, `ice`, `leaf`, `sludge`, `spark`, `psy`, `psychic`, `shadow`, `fairy`, `steel`, `earth`,
`rock`, `bug`, `dark`. Chorros continuos: `hydro`, `flame`, `solar`, `dragon`, `blizzard`.
Contacto (con `style: 'dash'`): `slam`, `wing`, `punch`, `steel`, `bug`, `dragon`.
