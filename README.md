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

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # genera dist/
```

Hecho con Phaser 3 + TypeScript + Vite. Se publica solo en GitHub Pages con cada push a `main`.

Los sprites provienen de [PokeAPI/sprites](https://github.com/PokeAPI/sprites). Pokémon es marca de Nintendo / Game Freak; este es un proyecto personal sin fines de lucro.
