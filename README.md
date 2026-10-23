# Poke Arena

Juego 2D de arena en tiempo real con Pokémon: te mueves libremente, lanzas ataques sin turnos en la dirección en que miras y cada ataque gasta energía. Jugador vs IA, equipos de 3.

## Controles

| Tecla | Acción |
|---|---|
| W A S D | Moverse (arriba, izquierda, abajo, derecha) |
| U I O P | Ataques 1 a 4 |
| Enter | Abrir menú (pausa la batalla) |
| Flechas ↑ ↓ | Moverse por el menú |
| Enter / Esc | Aceptar / volver |

Menú de pausa: cambiar de Pokémon y usar objetos (Poción, Éter).

Para sumar más combatientes, mira [docs/AGREGAR-POKEMON.md](docs/AGREGAR-POKEMON.md).

## Capturar Pokémon salvajes

En la pantalla de selección de equipo, **TAB** cambia entre *combate de arena* y *Pokémon salvaje*. En modo salvaje
el rival es un solo Pokémon de especie y nivel (5 a 60) al azar, y el menú de pausa (Enter) suma **Poké Balls**:

1. Elige una bola en el menú (junto a cada una se ve la probabilidad de captura actual).
2. Apunta y lanza con **ESPACIO** (con los controles de mouse, hacia el cursor).
3. Si la bola da en el blanco, el Pokémon entra en ella, se sacude y se decide si queda capturado.

La probabilidad usa la fórmula de la generación actual de los juegos: depende de la vida restante, del índice de
captura de la especie, de la bola (Poké Ball ×1, Super Ball ×1,5, Ultra Ball ×2 y Master Ball, que siempre captura) y
del nivel (por debajo del nivel 21 es más fácil). Está en `src/capture.ts`. No hay estados alterados ni capturas
críticas. Por ahora, al capturar solo termina la batalla; `onCaptured` en `BattleScene.ts` es el gancho donde, cuando
exista la historia, el Pokémon se sumará al equipo.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # genera dist/
```

Hecho con Phaser 3 + TypeScript + Vite. Se publica solo en GitHub Pages con cada push a `main`.

Los sprites provienen de [PokeAPI/sprites](https://github.com/PokeAPI/sprites). Pokémon es marca de Nintendo / Game Freak; este es un proyecto personal sin fines de lucro.
