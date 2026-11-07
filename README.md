# Poke Arena

Juego 2D de arena en tiempo real con Pokémon: te mueves libremente, lanzas ataques sin turnos en la dirección en que miras y cada ataque gasta energía. Jugador vs IA, equipos de 1 a 6 Pokémon.

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

## Estados alterados y la IA del rival

Hay **paralizado, dormido, envenenado, muy envenenado, quemado, congelado, confuso y retroceso**, con la duración y el daño
de los juegos traducidos a tiempo real (1 turno = lo que tarda un Pokémon en lanzar un ataque, 2,8 s). Cada uno tiene su
animación (rayitos, Z Z Z, burbujas moradas, llamitas, bloque de hielo, estrellas) y su color; en la barra de arriba
aparece una etiqueta junto al nombre (PAR, DOR, ENV, TOX, QUE, CON, CNF). Los causan ataques de estado (Hipnosis, Onda
Trueno, Tóxico, Fuego Fatuo...) y ataques de daño con la probabilidad de los juegos (Lanzallamas 10 % de quemar, Trueno 30 %
de paralizar...). Además facilitan la captura de Pokémon salvajes. Todo el detalle está en [docs/ESTADOS.md](docs/ESTADOS.md).

Los ataques también tienen la **precisión** de los juegos: los de 100 % salen siempre donde apuntas y los demás a veces se desvían un poco o mucho (detalle en el mismo documento). Tras curarse de un estado, un Pokémon resiste 7 s nuevos estados.

El rival ahora apunta con adelanto, esquiva proyectiles y ataques de área, usa los ataques de estado cuando sirven y, en
las batallas de equipos, cambia de Pokémon cuando le conviene (también explicado en ese documento).

### Ataques que bajan stats, curan y Teletransporte
- **Bajar stats del rival** (Gruñido, Malicioso, Agitacola, Chirrido, Ataque Arena, Pantalla de Humo...): son proyectiles que
  hay que acertar (el rival puede esquivarlos); si conectan bajan 1 o 2 etapas, de -6 a 6, como en los juegos. La
  **precisión** también es una etapa: cada una baja la precisión de todos sus ataques (x3/4, x3/5...) y hace que se desvíen.
  Algunos ataques de daño tienen una probabilidad de bajar un stat (Psíquico 10 % de Def. Esp., Bola Sombra 20 %...).
- **Curar:** Recuperación, Ovocuración, Relajo, Respiro, Fotosíntesis y Luz Lunar devuelven la mitad de los PS máximos;
  **Descanso** los devuelve todos, quita los estados y deja dormido 2 turnos. Tardan 12 s en recargarse y dejan quieto
  1 s. No se pueden usar con la vida llena. El rival los usa cuando le queda poca vida.
- **Absorber** (Absorber, Megaagotar, Gigadrenado, Chupavidas, Come Sueños, Beso Drenaje): curan a quien ataca el daño que
  hacen por 0,5 (50 %) × `DRAIN_SCALE` (2, en `src/data.ts`; la vida está multiplicada por 5 pero el daño no).
- **Teletransporte** (Abra): contra un **Pokémon salvaje**, si lo usa el jugador termina la batalla; un salvaje que lo sabe
  lo usa en cuanto le pegan y escapa (sin EXP ni captura). Contra un **entrenador** (o en la arena) se cambia por otro
  Pokémon del equipo: el jugador elige a cuál, y el rival entrenador lo usa si no tiene ataques para hacer daño. No se puede
  usar si no queda a quién cambiar.

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
  semilla fija.
- **Los PS y los PP se conservan entre batallas** (también los objetos gastados): nada se recupera solo, y en el menú
  Pokémon ves cuánto le queda a cada uno. Si pierdes, vuelves a la entrada y el equipo se cura. Al salir de la aventura
  al menú de equipos todo se reinicia.

### Segunda ruta: Desierto de Atacama
Al fondo de la Ruta Los Aromos (el camino sigue hasta el borde norte del mapa) se entra al **Desierto de Atacama**; al
fondo sur del desierto se vuelve. Es la misma idea que las conexiones entre rutas de los juegos: al salir por el borde
del mapa se oscurece la pantalla y se aparece en la entrada de la ruta vecina, con los Pokémon que tengas fuera
siguiéndote. El desierto tiene camino de tierra, cardones, dunas, formaciones de roca roja (Valle de la Luna), un salar
con laguna y **matorral seco** donde aparecen Pokémon salvajes de tierra, roca y fuego (Sandshrew, Diglett, Geodude,
Cubone, Rhyhorn, Ponyta... y, muy rara vez, Arcanine y Aerodactyl), de nivel 13 a 28. Las rutas se definen en `ROUTES`
(`src/route.ts`): cada una tiene su mapa, su tabla de encuentros y sus salidas (`exits`).

## Experiencia y niveles (aventura)

En la aventura cada Pokémon del equipo **empieza en nivel 8** (`START_LEVEL` en `src/exp.ts`) y sube ganando EXP; en la
arena y en el modo salvaje suelto todos siguen a nivel 50. Los números están en `src/exp.ts`:

- **Curva:** EXP total = nivel³ (la curva «rápida-media» de los juegos), hasta el nivel 100.
- **EXP por derrotado:** la fórmula de la generación 5: `(a·b·Lf / 5s) · ((2Lf+10)/(Lf+Lp+10))^2,5 + 1`. `a` vale 1,5
  contra entrenadores; `b` es la EXP base de la especie (estimada con sus stats base); `Lf` y `Lp` son el nivel del
  derrotado y del que recibe; `s`, los que participaron y siguen en pie.
- **Reparto:** solo ganan EXP los Pokémon que **pelearon contra ese rival y siguen con PS**; los que no salieron a la
  arena, o están debilitados, no reciben nada. Capturar un Pokémon también da EXP.
- **Al subir de nivel** se recalculan stats y PS máximos; los PS nuevos se suman a los que tenía (como en los juegos). Al
  terminar la batalla se ve cuánta EXP ganó cada uno y cómo cambiaron sus stats.
- **Si pierdes** vuelves a la entrada y el equipo se cura, pero **conserva nivel y EXP**. Salir al menú de equipos reinicia
  todo (no hay partida guardada todavía).
- El rival Anselmo pelea a nivel 10 (`RIVAL.level` en `src/route.ts`); la barra de EXP está en «Datos» del menú Pokémon.
- **Ataques por nivel y evoluciones:** ver la sección siguiente.

### Ataques que se aprenden y evoluciones (aventura)
Cada especie tiene definido qué ataque aprende en cada nivel y a qué nivel evoluciona (`src/learnsets.ts`, generado con
`tools/gen_learnsets.py` desde PokeAPI: las listas de Ultra Sol / Ultra Luna).

- En la aventura un Pokémon sale con los últimos hasta **4 ataques** que le tocan a su nivel (no con los 4 fijos de la arena).
  Los rivales y los salvajes también.
- Al subir de nivel, después de la batalla, aprende los ataques de esos niveles. Si ya tiene 4, el juego pregunta cuál
  **olvida** o si **no aprende** el nuevo (↑ ↓ y ENTER). Los PP del ataque nuevo salen completos.
- Al llegar a su nivel de evolución evoluciona (cambian especie, stats y PS máximos; conserva nivel, EXP y ataques). Si
  puede evolucionar en varias especies (Eevee) se elige. Las evoluciones que en los juegos son por piedra, intercambio o
  felicidad tienen un nivel asignado en `EVO_FALLBACK` (editable en `learnsets.ts`: piedra 30, intercambio 40, felicidad 32).
- Los niveles de evolución y de aprendizaje están en `src/learnsets.ts`; los ataques que no existían en el catálogo
  (172 de daño, 7 de mejora, 3 de estado) están en `src/moves_gen.ts` y se calculan con la misma escala de poder/costo.
- **Siguen sin existir** los ataques de campo y los que dependen de turnos (Protección, Reflejo, Clima, Trampas, Danza Lluvia,
  Sustituto, Maldición, Antojo...): se omiten de las listas. Algunas especies empiezan con 1 o 2 ataques.
- Para sumar generaciones nuevas: agrega las especies a `SPECIES` y corre `python3 tools/gen_learnsets.py 1 493`
  (o el rango que toque).

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # genera dist/
```

Hecho con Phaser 3 + TypeScript + Vite. Se publica solo en GitHub Pages con cada push a `main`.

Los sprites provienen de [PokeAPI/sprites](https://github.com/PokeAPI/sprites). Pokémon es marca de Nintendo / Game Freak; este es un proyecto personal sin fines de lucro.
