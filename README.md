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

Están los **151 Pokémon de la primera generación**. Los 11 primeros que se hicieron (Venusaur, Charizard, Blastoise, Pikachu,
Wigglytuff, Alakazam, Machamp, Golem, Gengar, Lapras y Dragonite) tienen ataques y efectos ajustados a mano en
`src/data.ts`; los otros 140 salen de `src/roster.ts`: stats base y tipos actuales, 4 ataques que cada especie aprende de
verdad en los juegos, y costo, recarga y proyectil calculados a partir del poder del ataque. Para cambiar un ataque o una
especie basta editar esa tabla. Las especies con muy pocos ataques tienen menos de 4: Magikarp solo
Salpicadura (que no hace nada) y Ditto solo Transformación, que lo convierte en el rival durante toda la batalla.

### Animaciones de los ataques
Los ataques de contacto rodean al Pokémon con efectos de su tipo (llamas, rayos, burbujas, hojas...), y cuanto más poder
tiene un ataque, más grande es el aura, el destello al lanzarlo y el impacto. Al conectar se suma una animación propia
sobre el rival (`hit` en `src/roster.ts`, dibujadas en `src/hitfx.ts`): garras, puños de cada tipo, mordiscos, cuernos,
una X de cuchillas, un martillo de agua, ladrillos que saltan, etc. El listado completo, ataque por ataque, está en
[docs/ATAQUES.md](docs/ATAQUES.md). Además hay ataques con forma propia (`style` en `src/data.ts`):

- **Terremoto** (grieta por el suelo), **Roca Afilada** (peñascos irregulares), **Avalancha** (rocas con sombra que avisa).
- **Surf** (ola ancha en una dirección), **Ventisca** (tormenta que avanza), **Trueno** (marca y rayo del cielo).
- **Vuelo, Bote y Excavar**: el Pokémon desaparece, una marca avisa dónde caerá y luego cae haciendo daño.
- **Ondas expansivas** (Onda Ígnea, Danza Pétalo, Zumbido, Voz Cautivadora, Come Sueños, Onda Mental...).
- **Rayo Solar** se carga ~1,8 s (se puede apuntar) y **Bomba Huevo** se lanza en arco y explota al caer.
- Chorros y proyectiles con diseño propio: Rayo Hielo, Hiperrayo, Pulso Umbrío, Látigo Cepa, Tornado, Llamarada...

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

## Modo aventura: Ruta Los Aromos

En la selección de equipo, **TAB** también tiene el modo *aventura*: el equipo elegido sale a caminar por una ruta
con hierba alta, como en los juegos de la serie. Se controla un entrenador huaso chileno (arte original, hecho con
`tools/make_trainer_sprite.py`).

- Camina con **W/A/S/D** o las flechas (o con clic del mouse, si los controles están en *Mouse*; el personaje busca el
  camino hasta ese punto). **ENTER** abre el menú (volumen, controles y salir).
- En la hierba alta puede aparecer un Pokémon salvaje (14 % por paso, y nunca en los 3 primeros pasos). Empieza la
  misma batalla del modo salvaje, con captura incluida; al huir o ganar vuelves al mismo lugar de la ruta.
- Al costado del camino espera **el huaso Anselmo** (`RIVAL` en `src/route.ts`): si cruzas su línea de visión te reta a un
  combate de equipos. No se puede huir ni capturar sus Pokémon; si pierdes vuelves a la entrada de la ruta, y si ganas
  ya no te reta de nuevo (hasta que salgas de la aventura). Su sprite sale de `tools/make_rival_sprite.py`.
- Qué aparece y a qué nivel está en `ROUTE_ENCOUNTERS` (`src/route.ts`); el mapa se genera en `buildRoute()` con una
  semilla fija. Por ahora la vida y los niveles se reinician en cada batalla.

### Segunda ruta: Desierto de Atacama
Al fondo de la Ruta Los Aromos (el camino sigue hasta el borde norte del mapa) se entra al **Desierto de Atacama**; al
fondo sur del desierto se vuelve. Es la misma idea que las conexiones entre rutas de los juegos: al salir por el borde
del mapa se oscurece la pantalla y se aparece en la entrada de la ruta vecina, con los Pokémon que tengas fuera
siguiéndote. El desierto tiene camino de tierra, cardones, dunas, formaciones de roca roja (Valle de la Luna), un salar
con laguna y **matorral seco** donde aparecen Pokémon salvajes de tierra, roca y fuego (Sandshrew, Diglett, Geodude,
Cubone, Rhyhorn, Ponyta... y, muy rara vez, Arcanine y Aerodactyl), de nivel 13 a 28. Las rutas se definen en `ROUTES`
(`src/route.ts`): cada una tiene su mapa, su tabla de encuentros y sus salidas (`exits`).

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # genera dist/
```

Hecho con Phaser 3 + TypeScript + Vite. Se publica solo en GitHub Pages con cada push a `main`.

Los sprites provienen de [PokeAPI/sprites](https://github.com/PokeAPI/sprites). Pokémon es marca de Nintendo / Game Freak; este es un proyecto personal sin fines de lucro.
