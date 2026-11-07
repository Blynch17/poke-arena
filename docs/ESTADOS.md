# Estados alterados

Los juegos cuentan en **turnos**; Poke Arena es en tiempo real, así que todo se traduce a tiempo con una medida:

> **1 turno = 2,8 s** (`TURN_MS` en `src/status.ts`): lo que tarda un Pokémon en lanzar un ataque de promedio.
> Un ataque de poder ~70 cuesta ~34 de energía y la energía se recupera a 12/s, así que manda la energía (~2,8 s);
> la recarga del propio ataque (~1,9 s) queda por debajo.

Los valores salen de la generación 5. Todos los números están en `src/status.ts` para poder ajustarlos.

| Estado | Cómo se ve | Qué hace | Duración | En los juegos |
|---|---|---|---|---|
| **Paralizado** (PAR) | Rayitos amarillos alrededor, sprite amarillento | No puede caminar. Cada intento de atacar falla el 25 % (y pierde 1,5 s sin atacar, sin gastar PP ni energía) | 5 turnos (~14 s) | Dura hasta curarse; velocidad a ¼ y 25 % de no moverse. Aquí la inmovilidad es más fuerte, por eso dura menos |
| **Dormido** (DOR) | Z Z Z que suben, sprite apagado | No camina, no apunta ni ataca | 1 a 3 turnos (2,8 a 8,4 s) | 1 a 3 turnos |
| **Envenenado** (ENV) | Burbujas moradas, sprite morado | Pierde 1/8 de sus PS máx. por turno | 8 turnos (~22 s) | 1/8 por turno, hasta curarse |
| **Muy envenenado** (TOX) | Burbujas más oscuras | Pierde n/16 por turno; *n* sube 1 cada turno (se reinicia al retirarlo) | 8 turnos | n/16 por turno |
| **Quemado** (QUE) | Llamitas, sprite rojizo | Pierde 1/8 por turno y sus ataques **físicos** hacen la mitad | 8 turnos | 1/8 por turno (gen. 5) y ataque a la mitad |
| **Congelado** (CON) | Bloque de hielo, sprite celeste | No camina, no apunta ni ataca. Un ataque de **fuego** lo descongela al instante | 20 % de descongelarse por turno (promedio 5 turnos), con tope de 9 | 20 % por turno |
| **Confuso** (CNF) | Estrellas girando sobre la cabeza | Cada intento de atacar tiene 50 % de fallar y golpearse a sí mismo (ataque físico de 40 de poder sin tipo) | 1 a 4 turnos | 1 a 4 turnos, 50 % de golpearse |
| **Retroceso** | «¡Retrocedió!» | Interrumpe lo que hacía (incluso una carga) y lo deja 0,9 s sin actuar | 0,9 s | Pierde ese turno |

**Daño por turno.** Los PS en Poke Arena están multiplicados por 5 (`HP_MULT`) pero los ataques no, así que aplicar la
fracción de los juegos tal cual haría que una quemadura pegue más que un ataque de verdad. Por eso el daño de la
quemadura y el veneno se divide entre `HP_MULT`: queda en la **misma proporción respecto de un ataque que en los
juegos**. En números: una quemadura o veneno completo quita ~19 % de los PS, y un tóxico completo ~45 %.

**Inmunidades** (como en los juegos): los de tipo fuego no se queman, hielo no se congela, veneno y acero no se
envenenan, eléctrico no se paraliza, y Onda Trueno no afecta a los de tipo tierra. Un Pokémon solo puede tener un
estado principal a la vez (más la confusión). Los estados se pierden al debilitarse y no pasan de una batalla a otra.

**Resistencia tras curarse.** Cuando un Pokémon se cura de un estado (o despierta), aguanta 7 s sin que le entre otro
(`STATUS_GRACE_MS`): sale «¡Resistió!». Así no se encadena sueño tras sueño ni parálisis tras parálisis.

**Capturar.** Un Pokémon salvaje con estado es más fácil de capturar: ×2,5 si está dormido o congelado y ×1,5 con
cualquier otro (el bonus de la fórmula de la generación 8; se nota en el porcentaje del menú de Poké Balls).

## Ataques de estado

Se lanzan como proyectil y, si dan en el blanco, aplican el estado sin hacer daño.

| Ataque | Estado | Quién lo tiene |
|---|---|---|
| Hipnosis | Dormido | Gengar, Gastly, Drowzee, Hypno, Exeggcute, Exeggutor, Poliwag, Poliwhirl |
| Somnífero | Dormido | Bulbasaur, Ivysaur, Venusaur, Butterfree, Oddish, Gloom, Vileplume, Venonat, Venomoth, Bellsprout, Weepinbell, Victreebel, Tangela |
| Espora | Dormido | Paras, Parasect |
| Canto | Dormido | Wigglytuff, Jigglypuff, Clefairy, Clefable, Chansey |
| Beso Amoroso | Dormido | Jynx |
| Onda Trueno | Paralizado | Pikachu, Raichu, Magnemite, Magneton, Voltorb, Electrode, Electabuzz, Jolteon, Zapdos, Dratini, Dragonair |
| Deslumbrar | Paralizado | Ekans, Arbok |
| Tóxico | Muy envenenado | Nidoqueen, Nidoking, Tentacool, Tentacruel, Grimer, Muk, Koffing, Weezing |
| Fuego Fatuo | Quemado | Vulpix, Ninetales |
| Supersónico | Confuso | Zubat, Golbat |
| Rayo Confuso | Confuso | Haunter |

(Paralizador y Polvo Veneno también existen en `STATUS_MOVES` de `src/roster.ts`, listos para dárselos a quien se quiera.)

## Efectos secundarios de los ataques de daño

La probabilidad es la de los juegos (gen. 5). Está en `INFLICT` (`src/roster.ts`), por nombre de ataque.

| Estado | Ataques |
|---|---|
| Quemar 10 % | Ascuas, Lanzallamas, Llamarada, Onda Ígnea, Puño Fuego, Rueda Fuego, Envite Ígneo |
| Paralizar 10 % | Impactrueno, Rayo, Puño Trueno |
| Paralizar 30 % | Trueno, Chispazo, Lengüetazo, Golpe Cuerpo, Dragoaliento, Bote |
| Congelar 10 % | Rayo Hielo, Ventisca, Puño Hielo |
| Envenenar 30 % | Picotazo Veneno, Residuos, Bomba Lodo, Puya Nociva |
| Confundir | Confusión y Psicorrayo (10 %), Puño Dinámico (100 %) |
| Retroceso 30 % | Mordisco, Golpe Cabeza, Pisotón, Avalancha, Tajo Aéreo |
| Retroceso 20 % | Cascada, Ciclón, Pulso Umbrío, Cabezazo Zen |
| Retroceso 10 % | Hipercolmillo |
| Quemar, paralizar o congelar (20 %, al azar) | Triataque |

Los ataques que no afectan al rival (por tipo) tampoco causan estado. En la pantalla de datos de cada Pokémon cada
ataque muestra el estado que puede causar.

# La IA del rival

Qué hace el rival (`aiUpdate` / `aiAttack` en `src/scenes/BattleScene.ts`):

- **Apunta con adelanto**: dispara hacia donde estará el jugador cuando llegue el proyectil, según su velocidad.
- **Esquiva** proyectiles (calculando su punto de mayor acercamiento), chorros, ataques de área (ondas, olas,
  tormentas, rocas que caen, rayo del cielo), la marca de caída de Vuelo/Bote/Excavar y embestidas. También **lee la
  puntería** del jugador y se sale de su línea de tiro. Reacciona con un pequeño retraso y a veces no ve un
  proyectil, así que se le puede acertar. Al esquivar tiene en cuenta las paredes.
- **Elige mejor el ataque**: evita los que no afectan, prefiere rematar, valora los que pueden causar estado, y si el
  jugador no puede moverse (dormido, congelado o paralizado) prefiere los ataques lentos y se acerca a pegarle de cerca.
- **Usa ataques de estado** con un enfriamiento largo: mínimo 9 s entre uno y otro (`AI_STATUS_COOLDOWN_MS`, un poco más
  al azar) y 20 s si el último sí causó el estado (`AI_STATUS_COOLDOWN_HIT_MS`). No los usa contra quien acaba de curarse. Los usa cuando sirven (no quema a un tipo fuego, no envenena a un tipo veneno, no duerme a quien
  ya tiene un estado...) y se prepara con mejoras de stats si el rival no puede moverse.
- **Cambia de Pokémon** en las batallas de equipos (no en las salvajes): si el actual está dormido o congelado por
  mucho rato, casi sin vida o en una mala pelea de tipos, entra un compañero que le convenga más. Máximo una vez cada 9 s.

# Precisión de los ataques

Cada ataque tiene la precisión que tiene en los juegos (campo `accuracy`; la tabla `ACCURACY` de `src/roster.ts`, por
nombre; sin dato = 100 %). Los de 100 % salen siempre justo donde se apuntó. En los demás, con probabilidad (100 − precisión):

- **60 % de esas veces, desvío leve**: el ataque pasa unos 25 a 90 px al costado del rival. A veces todavía le pega.
- **40 %, desvío grande**: 130 a 250 px al costado; casi siempre falla.

El desvío se mide en píxeles a la distancia del rival, así que la precisión pesa igual de cerca que de lejos. En la práctica
un ataque con 70 % acierta ~68 % de las veces y uno con 50 %, ~57 %.

| Tipo de ataque | Qué pasa cuando se desvía |
|---|---|
| Proyectiles, chorros, abanicos | Salen girados (todo el abanico junto) |
| Embestidas y Lengüetazo | Se lanzan hacia el lado desviado |
| Terremoto, Surf, Ventisca, picos y lluvia de rocas | La dirección sale girada |
| Bomba Huevo | Cae corrida |
| Trueno (rayo del cielo) y Vuelo, Bote, Excavar | Cae corrido del rival |
| Onda expansiva redonda (Onda Ígnea) | No tiene a dónde desviarse: falla («¡Falló!») |

Ataques con precisión menor a 100: Trueno y Ventisca 70, Roca Afilada 80, Hidrobomba 80, Megapatada 75, Puño Dinámico 50,
Cola Férrea 75, Llamarada 85, Hipnosis 60, Canto 55, Supersónico 55, entre otros (la pantalla de datos de cada Pokémon muestra
«Prec.» en cada ataque). La IA lo tiene en cuenta al elegir ataque.


## Bajar stats, curar y Teletransporte

Los ataques de estado que **bajan stats del rival** (`debuff` en `Move`) son proyectiles: hay que acertarlos y, si conectan,
bajan etapas (de -6 a 6). La precisión es una etapa más (`acc`): x3/4 por etapa baja, x3/5 con dos... y los ataques que no
aciertan se desvían según la precisión que quede (ver la sección de precisión). Los ataques de daño pueden bajar un stat con
una probabilidad (`drop`: Psíquico 10 % Def. Esp., Bola Sombra 20 %, Triturar 20 % Def.).

Los que **curan** (`heal`) devuelven una fracción de los PS máximos (Recuperación 50 %; Descanso 100 % y 2 turnos de sueño),
con 12 s de recarga (`HEAL_COOLDOWN`) y 1 s inmóvil. Los de **absorción** (`drain`) curan `daño × fracción × DRAIN_SCALE`.

**Teletransporte** (`teleport`): contra un salvaje termina la batalla (si lo usa el jugador, o si lo usa el salvaje tras
recibir un golpe); contra un entrenador, quien lo usa se cambia por otro Pokémon.

La IA los usa así: cura con menos de 45 % de PS (Descanso con menos de 30 %), baja stats cuando al rival le sirve y no está
ya muy bajo (comparte el enfriamiento de los ataques de estado) y, si es entrenador y solo tiene ataques de estado, se
teletransporta cada 6 s.
