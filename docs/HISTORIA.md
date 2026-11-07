# Historia de Poke Arena: «El Completo Perfecto» (borrador v2)

Documento de diseño. Lo que está aquí es el guion y la estructura; el código se va haciendo por partes (ver sección 9).
Pokémon: **de la 1.ª a la 4.ª generación** (493). Cada zona lista los Gen 1 como base y, aparte, los Gen 2–4 que se suman.

---

## 1. La trama

**El pueblo.** *Cerro Pelado de Abajo*, tan perdido que no sale en Google Maps y donde la señal del celular solo funciona
subiéndose al techo de la iglesia. Su único negocio es el carrito de completos de **Don Eladio**, abuelo del protagonista
(un huaso; el jugador le pone nombre).

**El problema.** Llega una carta certificada (con 4 meses de atraso): el carrito no tiene *resolución sanitaria* y el
pueblo será «reclasificado como localidad sin relevancia estratégica», o sea, borrado del mapa. La única excepción es
para el ganador de la **Copa Nacional del Completo**, que se corre en Santiago (donde, claro, se decide todo).

**La condición.** Para inscribirse hay que juntar **8 Sellos de Calidad**, uno por cada gran zona, entregados por un
*Maestro Completero* local que solo te lo da si le ganas en duelo Pokémon y le sacas el secreto de su completo.

**El villano.** **Chef Tomás Vial-Echeñique, «Chef Autor»**, y su empresa *Concept Gourmet S.A.* («reinventando lo
auténtico®»). Quiere ganar la Copa, patentar la palabra «completo» y que solo se pueda vender el suyo (espuma de
palta, mayonesa en gotero, vienesa de lujo a $18.000). Abre *Completo Lab* donde antes había fondas y compra a los
jurados con «auspicios». Sus secuaces son **los Foodies**: gente con iPad que habla de «experiencia» y «propuesta de valor».

**El rival: Anselmo.** Es **del mismo pueblo** y tiene un **puesto de churrascos** («Churrascos Anselmo», frente al
carrito del abuelo; competencia de toda la vida). Tiene a medio pueblo comiendo chacarero. Se va a la Copa porque su
puesto tampoco tiene resolución sanitaria, y avanza siempre un paso adelante: huaso orgulloso → influencer de comida
(«¡Hola, churrasqueros!») → casi vendido al Chef Autor → **jurado del Chacarero en el Alto Mando**. Se dicen de todo y,
en el fondo, se quieren.

**La Liga.** Con 8 sellos se abre el **Concurso Nacional del Mejor Completo** en el **Costanera Center**: cuatro jurados
(Italiano, Completo, Dinámico y Chacarero) y el **Campeón**, un niño gordito de 10 años cuyo completo es **pan, vienesa y
ketchup**.

**El final.** El huaso le gana al niño (y eso hace famoso al pueblo). Ver sección 6.

**El tono.** Sátira sobre estereotipos e instituciones: centralismo, clasismo, xenofobia, burocracia, turismo, el
cuñado. Regla de oficio: el chiste apunta al **prejuicio** y a **quien lo dice**, no al más débil.

---

## 2. Estructura: el mayor zig-zag

Cada zona se pisa **al menos dos veces** (Santiago tres). **Rapa Nui se visita una sola vez antes del 8.º sello**; tras
ganar el 8.º gimnasio se puede **volver** (postgame) a una isla con subhistorias de legendarios y la **Master Ball**. Las
pasadas suben de nivel y abren subzonas nuevas.

| # | Pasada | Qué pasa | Sello | Nv rutas |
|---|---|---|---|---|
| 1 | **Centro A** | Tutorial, Ruta Los Aromos, la carta, Anselmo y su puesto | – | 3–14 |
| 2 | **Valparaíso A** | Plan, cerros, Cordillera, Concón. Primer *Completo Lab* | **1** Agua | 10–24 |
| 3 | **Norte Chico A** | La Serena, Elqui, Limarí. El observatorio está «nublado»: vuelva en 3 semanas | – | 16–28 |
| 4 | **Norte Grande A** | Arica, Iquique, salitreras, Atacama sur, la mina. Bono = **camioneta 4x4** | **2** Roca/Tierra | 22–36 |
| 5 | **Zona Sur A** | Bus de 30 h: Talca, Concepción, Lota, Valdivia. El volcán está en **alerta roja** | – | 26–40 |
| 6 | **Santiago A** | Aeropuerto, Estación Central, La Pintana. Compras: Tarjeta de Turista y Traje de Gala | – | 28–36 |
| 7 | **Rapa Nui** *(única vez antes del 8.º sello)* | Vuelo Latam. Tangata Manu y Tapati | **3** Planta | 34–46 |
| 8 | **Centro B** | Vuelves al pueblo: el Fiscalizador clausuró el carrito. El Chef cortejó a Anselmo | – | 36–46 |
| 9 | **Valparaíso B** | Viña, Reñaca, Casino y Festival (Traje de Gala). El Chef compró el Casino | – | 40–50 |
| 10 | **Norte Chico B** | El cielo se despejó: Cochiguaz, Desierto Florido y el observatorio de noche | **4** Psíquico | 42–54 |
| 11 | **Zona Sur B** | Alerta amarilla: Pucón, Huerquehue, Frutillar, el volcán | **5** Fuego | 46–58 |
| 12 | **Norte Grande B** | Altiplano, Putre, Parinacota, salares, Calama (4x4). El Chef quiere «sal de altura» | – | 46–58 |
| 13 | **Santiago B** | Ñuñoa, Providencia, Apoquindo, San Cristóbal, Cajón del Maipo | – | 38–56 |
| 14 | **Chiloé A** | Ferry desde Puerto Montt: Ancud, Castro, Chepu, Achao | **6** Fantasma | 48–58 |
| 15 | **Patagonia A** | Aysén, Natales, Punta Arenas. El parque Torres del Paine tiene «reservas hasta 2027» | – | 50–60 |
| 16 | **Chiloé B** | Cucao, Quicaví, Cueva de los Brujos (de noche, con invitación) | – | 56–66 |
| 17 | **Patagonia B** | Torres del Paine, Grey, Glaciar Exploradores, Tierra del Fuego | **7** Hielo | 58–70 |
| 18 | **Santiago C** | Lo Barnechea y el Centro. La Moneda recibe solo con 7 sellos | **8** Normal/Lucha | 56–68 |
| 19 | **Costanera Center** | Alto Mando y Campeón | Copa | 70–80 |
| 20 | **Postgame** | Legendarios, rutas extra, revanchas. **Vuelta a Rapa Nui** (ver 4.6) | – | 55–85 |

> Por qué se vuelve a cada zona: ver la columna «Qué pasa». Cada vuelta es una historia nueva, no un trámite.

### Niveles de líderes
Valparaíso 22–26 · Norte Grande 30–34 · Rapa Nui 38–42 · Norte Chico 44–47 · Sur 50–53 · Chiloé 55–58 · Patagonia 60–63 ·
Santiago 64–68 · Alto Mando 70–74 · Campeón 76–80.
> Las batallas de líder dependen del **orden en que consigues los sellos**, no de la zona: si lo cambias, el juego te
> fija el siguiente líder en el nivel que toca.

### Objetos clave (hacen de MO/HM)
| Objeto | Cómo se consigue | Sirve para |
|---|---|---|
| Pasajes | Se compran/ganan | Mover por el mapa del país |
| **Bote** | Valparaíso A | Cruzar agua |
| **Casco** | Mina (Norte Grande A) | Cuevas oscuras y rocas |
| **Machete** | Zona Sur A | Maleza (bosques) |
| **Camioneta 4x4** | Bono del minero | Altiplano, ripio |
| **Paraguas** | Zona Sur A | Lluvia y resistir el viento |
| **Bip!** | Santiago A | Metro: viaje rápido |
| **Tarjeta de Turista** | Santiago A | Entrar a Rapa Nui |
| **Traje de Gala** | Santiago A (Providencia) | Zona rica de Viña/Reñaca y Lo Barnechea |
| **Poncho Térmico** | Sur B | Glaciares y Patagonia |
| **Pase de Prensa** | Postgame | Zonas de legendarios |

### Clima y arena
Norte Grande: sol (energía se recupera más lento) · Altiplano: altura (poca energía al inicio) · Valparaíso: camanchaca
(los proyectiles se ven tarde) · Zona Sur: lluvia (agua +20 %, fuego −20 %) · Patagonia: **viento** que empuja los
proyectiles · Santiago: preemergencia (humo y veneno más fuertes).

---

## 3. Personajes recurrentes, cameos y mecánicas con humor

- **Don Eladio:** llama cuando hay señal («me escuchai… entrecortado»). Refranes sin sentido.
- **Anselmo:** rival y vecino, con puesto de churrascos. En cada zona hace algo peor que lo anterior: vende
  chacarero a turistas, abre un «Churrasco Lab» (copia del Chef), da un «live» en TikTok.
- **Los Foodies:** apodan a sus Pokémon «Umami» y «Fusión».
- **Chef Autor:** batallas en Norte Grande A (catering de la mina), Valparaíso B (Casino), Rapa Nui (beach club),
  Chiloé A (curanto deconstruido), Patagonia B (completo de $18.000) y el final.
- **El Fiscalizador:** inspector del SEREMI de salud que pide «la resolución sanitaria» en cada ciudad.
- **La dupla de turistas gringos:** «Is this typical?». Cada vez más rotos.
- **El cuñado:** NPC en cada pueblo que opina de todo («la Roja no va al Mundial, pero él sabe cómo se arregla»).

### Cameos reales (solo su faceta pública, sin inventar delitos ni acusaciones)
- **Valparaíso/Viña:** Mon Laferte, Paloma Mami, Los Jaivas (en una fonda del cerro), Naya Fácil (en Reñaca), Jordi Castell,
  Fran Maira.
- **Norte Chico:** Gabriela Mistral y Pablo Neruda como **estatuas** que saludan (con respeto).
- **Norte Grande:** Américo (en la mina, el día de pago), Luis Jara (en una fiesta de La Tirana).
- **Sur:** Los Bunkers y Los Tres (Concepción), Kristel Köbrich (nadando en el Calle-Calle).
- **Santiago:** Don Francisco (Teletón), Kike Morandé, Sergio Lagos, Tonka Tomicic, Karen Doggenweiler, Rafael Araneda,
  Stefan Kramer, Coco Legrand, Marcelo «Chino» Ríos, Nicolás Massú, Fernando González, Iván Zamorano, Marcelo Salas,
  Alexis Sánchez, Arturo Vidal, Claudio Bravo, Gary Medel, Jorge González (Ñuñoa), Gepe, Francisca Valenzuela, Pamela Díaz,
  Michelle Bachelet, Gabriel Boric, Evelyn Matthei y **José Antonio Kast** (líder del gimnasio).
- **Patagonia:** Tomás González (gimnasta) bajando del glaciar en cuerda.

### Mecánicas con humor
El vuelto en dulces · El baño cuesta $500 · Objetos chilenos de curación (mote con huesillo = PS, empanada de pino =
revivir, sopaipilla pasada = quema, té con limón = veneno, mate de boldo = confusión, agua de hierbas = sueño) · El
**terremoto** (pipeño con helado) causa confusión · Minijuegos: rayuela, emboque, trompo, volantín, palo ensebado,
cueca, rodeo, «cuánto tardas en comer un completo».

---

## 4. Las zonas

Notación: **negrita** = común · normal = poco común · (paréntesis) = raro · ★ = exclusivo de esa ruta. Los porcentajes
exactos se fijan al implementar cada ruta.

### 4.0 Zona Centro · Nv 3–14 (A) y 36–46 (B)

| Ruta | Pasada | Nv | Pokémon | Notas |
|---|---|---|---|---|
| Cerro Pelado de Abajo | A/B | – | – | Pueblo, carrito, **Churrascos Anselmo**, posta rural |
| Ruta Los Aromos *(existe)* | A | 3–10 | **Rattata, Pidgey, Caterpie, Weedle**, Oddish, Bellsprout, (Mankey, Growlithe) | Anselmo |
| Camino del Rodeo | A | 6–12 | **Doduo, Spearow, Rattata**, Ponyta, Nidoran, (Tauros, Pinsir) | Medialuna |
| Pomaire | A | 8–14 | **Diglett, Geodude, Sandshrew**, Slowpoke, (Rhyhorn) | Chanchos de greda |
| Viñas de Colchagua | A | 10–16 | **Oddish, Bellsprout, Paras**, Venonat, Exeggcute, (Tangela) | Vendimia |
| Lago Rapel | A | 8–16 | **Psyduck, Poliwag, Magikarp**, Goldeen, Krabby, (Slowbro) | Pesca |
| Despoblado de Atacama *(existe)* | A | 13–28 | tierra/roca/fuego | Muro de nivel |
| Cordillera de Cerro Pelado | B | 36–42 | **Machoke, Graveler, Fearow**, Onix, Rapidash, (Hitmonlee, Larvitar) | Vuelve el huaso |
| Termas y Embalse | B | 38–46 | **Golduck, Slowbro, Poliwhirl**, Seaking, Magneton, (Lapras, Vaporeon) | Termas de Cauquenes |

**Gen 2–4:** Hoppip, Sentret, Hoothoot, Spinarak, Zigzagoon, Starly, Shinx, Buneary, Pachirisu (más Larvitar/Girafarig en B).

**Bromas:** fonda del 18 permanente (aunque sea marzo), chicha en cacho, el tío que canta cueca sin preguntar, vecino al
que debes $200 desde 1998, el huaso que «apenas sale a Rancagua para comprar un clavo», la posta con un médico que llega
los martes, el mapa donde el pueblo es una mancha de café, el alcalde que «gestionó» el pavimento y lo dejó en el
cerro, el gallo que canta a las 3 AM «porque es el horario país», el bus rural que pasa «a veces».

**Subhistorias:** palo ensebado trucado por Anselmo; **Centro B:** el Fiscalizador clausura el carrito y Anselmo
vende churrascos con permiso (comprado). Hay que reabrirlo ganando un duelo a un jurado de feria.

### 4.1 Valparaíso y alrededores · Sello 1 · Agua

Subzonas: Plan · Cerros Alegre/Concepción · Cerro Cordillera · Dunas de Concón · **Viña y Reñaca** · Casino ·
Quinta Vergara · Laguna Verde y Quintay (B).

| Ruta | Pasada | Nv | Pokémon | Notas |
|---|---|---|---|---|
| Caleta Portales / Playa Ancha | A | 10–15 | **Tentacool, Krabby, Magikarp**, Shellder, Staryu, Pidgey, (Seel) | Gaviotas ladronas |
| Cerros Alegre y Concepción | A | 12–18 | **Meowth, Jigglypuff, Drowzee**, Clefairy, Abra, (Mr. Mime★) | Artistas |
| Cerro Cordillera | A | 14–20 | **Rattata, Grimer, Koffing**, Ekans, Growlithe, Machop, (Muk) | Flaites |
| Dunas de Concón | A | 16–24 | **Sandshrew, Diglett, Geodude**, Cubone, Sandslash, (Scyther) | Sandboard |
| Viña y Reñaca | B | 40–46 | **Persian, Vulpix, Horsea**, Staryu, Growlithe, Ponyta, (Arcanine, Lapras) | Traje de Gala |
| Casino de Viña | B | 42–48 | **Voltorb, Magnemite, Meowth**, Electrode, (Porygon★) | Fichas |
| Quinta Vergara (Monstruo) | B | 44–50 | **Jigglypuff, Loudred, Chatot**, Wigglytuff, Exploud | Jefe «El Monstruo» |
| Laguna Verde / Quintay | B | 42–48 | **Wingull, Pelipper, Krabby**, Kingler, Tentacruel, (Gyarados) | Cuevas y reservas |

**Gen 2–4:** Wingull, Pelipper, Marill, Wooper, Remoraid, Buizel, Finneon, Shellos, Stunky, Glameow, Houndour, Murkrow,
Smoochum, Misdreavus, Chingling, Porygon2.

**Líder (Nv 22–26):** **Capitán Zósimo «El Lobo» Barahona**, dirigente portuario. Gimnasio en un carguero del Muelle Barón,
cerrado por **paro portuario** (lo abres haciéndole un favor al sindicato). Equipo: Tentacruel, Starmie, Kingler, Cloyster,
Poliwhirl, Gyarados.
**Completo — «El Porteño»:** vienesa, papas fritas, cebolla caramelizada, huevo frito, mayonesa de erizo y pebre de
cochayuyo (una chorrillana en pan).

**Bromas y estereotipos**
- **Orinar en público:** la *Ruta del Meado*: NPCs que dicen «no es lo que parece» (sí es), baños de $500, el
  carabinero que te multa por «ofender el pudor» pero no por el asalto. Hay un cartel «Patrimonio de la Humanidad y de
  otras cosas».
- **Gringo en la zona flaite**, con GoPro y mochila abierta. Le quedan los calcetines.
- **Artistas bohemios:** el poeta que vende un poema por $1.000 y vive en un depto «heredado» en Cerro Alegre; el mimo
  (Mr. Mime) que no deja pasar; el grafiti que es arte y el que es «tag», debate de siglos.
- **Ascensores** que «funcionan hoy» (el 30 %). Perros callejeros con mejor estilo que el dueño. Los cerros sin agua
  pero con vista. Las micros que suben como si no hubiera mañana.
- **Reñaca vs. el Plan:** cuicos en camioneta con tabla de surf que no han surfeado; edificios que le quitaron el
  mar a todos; la **Reñaca de febrero** (hacinamiento total).
- **Festival de Viña:** *El Monstruo* silba, la Gaviota de plata, un humorista del año pasado que sigue en el escenario;
  Mon Laferte da un concierto sorpresa; el cantante que se baja llorando.
- **Casino:** «ya casi lo logro», fichas, el señor de 80 años con el mismo vaso desde 1994, Porygon como premio.
- **Cuicos de Viña** que dicen «Valpo es para ir a carretear» y no ven un cerro de día.
- **Chef Autor:** «Completo Lab» en un caserón patrimonial con espuma de palta; los vecinos protestan por el ruido
  del blender.
- **Incendios de los cerros** y tomas con vista al mar que cotizan más que tu departamento.

**Subhistorias:** *El Poema Robado*, *La Huelga* (paro portuario), **B:** *El Casino* (el Chef lo compró) y *La
Noche del Monstruo*.

### 4.2 Norte Chico y Valle Central · Sello 4 · Psíquico

Subzonas: Valle del Aconcagua · La Serena–Coquimbo · Valle del Elqui (Vicuña, Pisco Elqui, Cochiguaz) · Limarí (Ovalle,
Tongoy) · Observatorios · Huasco (Desierto Florido).

| Ruta | Pasada | Nv | Pokémon | Notas |
|---|---|---|---|---|
| Valle del Aconcagua | A | 16–22 | **Ponyta, Doduo, Oddish**, Bellsprout, Mankey, (Tauros) | Huasos de verdad |
| Caleta Peñuelas / Tongoy | A | 18–24 | **Krabby, Shellder, Staryu**, Tentacool, Slowpoke, (Seel) | Ostiones |
| Valle del Elqui (pisqueras) | A | 20–26 | **Drowzee, Slowpoke, Exeggcute**, Ponyta, Oddish, (Abra, Kadabra) | Pisco |
| Limarí (cabras y quesos) | A | 22–28 | **Doduo, Tauros, Geodude**, Rapidash, Sandslash, (Pinsir, Mareep★) | Cabras |
| Cochiguaz (cosmovisión) | B | 42–48 | **Abra, Kadabra, Clefairy**, Hypno, Mr. Mime, (Girafarig, Natu, Jynx) | Ovnis y chakras |
| Desierto Florido *(evento)* | B | 44–50 | **Oddish, Gloom, Bellsprout**, Butterfree, Tangela, (Vileplume, Exeggutor, Shaymin) | Pocos días |
| Mamalluca / Tololo | B | 46–52 | **Abra, Staryu, Clefairy**, Magnemite, Starmie, (Hypno, Lunatone★ de noche, Solrock★ de día) | Observatorio |

**Gen 2–4:** Natu, Xatu, Smeargle, Girafarig, Sudowoodo, Bellossom, Baltoy, Claydol, Chimecho, Lunatone, Solrock,
Bronzor, Chingling, Munchlax (cuando haya).

**Líder (Nv 44–47):** **Dr. Sebastián «Seba» Aldunate**, astrónomo con doctorado en Alemania que hoy hace tours a
gringos. Gimnasio en el observatorio, de noche. Equipo: Alakazam, Starmie, Hypno, Mr. Mime, Slowbro, Exeggutor (+ Lunatone).
**Completo — «El Eclipse»:** vienesa de cabra, queso de cabra, papaya confitada, salsa de pisco, ají de Elqui y
pan de luna (se vende solo de noche).

**Bromas y estereotipos**
- **El pisco:** «¡es chileno!» (Pisco Elqui se llamaba La Unión hasta 1936, cambió de nombre para quedarse con la
  denominación). La discusión con el vecino del norte se resuelve en un duelo.
- **Astronomía:** «tenemos el mejor cielo del mundo y lo alquilamos»; el aficionado con telescopio de 1989 que ve un
  planeta nuevo (es una ampolleta); la nube que aparece justo cuando llegan los turistas; tours a las 3 AM «para
  ver bien el cielo».
- **New age en Cochiguaz:** ovnis, chakras, constelaciones familiares, el curandero certificado por Instagram, el
  que «vive en la energía» y debe tres meses de arriendo.
- **Huasos y viñas:** el enólogo que habla de «taninos» y toma de la caja; el viñatero que dice «vendimia» cuando es
  fiesta; el huaso de cargo que nunca montó un caballo.
- **Regionalismo:** La Serena (la ciudad de las 29 iglesias… y 31 estacionamientos) vs. Coquimbo («el puerto que le
  paga a La Serena»); el Faro Monumental «de nadie».
- **Papayas** más caras que el pisco; la **Cruz del Tercer Milenio** que se ve desde todos lados menos de cerca.
- **Mistral y Neruda** como estatuas que saludan. «Me dijeron que acá se vive hasta los 100 años… porque se miente
  la edad».
- **Tren de cabras** y quesos con denominación de origen inventada.

**Subhistorias:** *Contactado* (un vecino jura que lo abdujeron), *El Cielo Alquilado* (el telescopio chileno solo para
fotos), **A:** *La Nube* (el observatorio cerrado por «condiciones atmosféricas»; la verdad: reserva privada del Chef).

### 4.3 Norte Grande · Sello 2 · Roca/Tierra

Subzonas: Arica · Iquique · Pampa del Tamarugal · Oficinas salitreras · Atacama sur · Calama y la mina · (B)
Altiplano (Putre, Lauca, Parinacota) · salares · San Pedro y Tatio · ALMA.

| Ruta | Pasada | Nv | Pokémon | Notas |
|---|---|---|---|---|
| Playa Chinchorro / Valle de Azapa | A | 22–28 | **Tentacool, Krabby, Pidgey**, Doduo, Diglett, Sandshrew | Aceitunas |
| Morro y Frontera (Chacalluta) | A | 24–30 | **Machop, Mankey, Meowth**, Primeape, Growlithe, Pidgeotto | Contrabando |
| Costanera de Iquique / Cavancha | A | 24–31 | **Staryu, Krabby, Tentacool**, Slowpoke, Seel, (Starmie) | Playas |
| Cerro Dragón / Pampa del Tamarugal | A | 26–32 | **Sandshrew, Diglett, Cubone**, Dugtrio, Sandslash, Ekans, Rhyhorn, (Trapinch) | Dunas |
| Oficinas salitreras (Humberstone) | A | 28–34 | **Gastly, Cubone, Zubat**, Haunter, Marowak, Koffing, (Golbat, Misdreavus) | Pueblo fantasma |
| Despoblado de Atacama *(existe)* | A | 13–28 | tierra/roca/fuego | Enlace |
| Mina de Codelco (Chuquicamata) | A | 32–36 | **Geodude, Graveler, Machop**, Onix, Dugtrio, Golem, Rhydon, Cubone | Casco |
| Altiplano: Putre – Lauca | B | 46–52 | **Ponyta, Doduo, Fearow**, Pidgeotto, Golduck, Psyduck, (Lapras, Chansey) | Soroche |
| Salar de Atacama (fósiles) | B | 46–52 | **Doduo, Dodrio, Sandslash**, Ponyta, Rhyhorn, (Kabuto★, Omanyte★, Aerodactyl, Lileep★, Anorith★) | Fósiles |
| Salar de Surire | B | 48–54 | **Dodrio, Rhyhorn, Sandslash**, Golem, Onix, (Rhydon, Kabutops, Cradily, Armaldo) | Flamencos |
| San Pedro / Tatio / Valle de la Luna | B | 50–56 | **Geodude, Graveler, Onix**, Rhyhorn, Vulpix, Hippopotas, (Magmar, Rhydon, Heatran) | Gringos y géiseres |
| Volcán Parinacota | B | 52–58 | **Magmar, Golem, Graveler**, Rapidash, (Electabuzz, Electrode, Zapdos) | Tormenta |

**Gen 2–4:** Phanpy, Donphan, Larvitar, Trapinch, Cacnea, Cacturne, Baltoy, Numel, Camerupt, Torkoal, Hippopotas,
Hippowdon, Gible, Skorupi, Drapion, Nosepass, Probopass, Lileep, Anorith.

**Líder (Nv 30–34):** **Don Heriberto «Beto» Cortés**, capataz de Codelco. Gimnasio en el **rajo de Chuquicamata**, a las
7 AM. Equipo: Golem, Rhydon, Onix, Dugtrio, Sandslash, Marowak.
**Completo — «El Tres Turnos»:** pan de campo, vienesa, charqui de llama, queso, aceituna de Azapa, ají de Pica y
limón.

**Bromas y estereotipos**
- **Minero recién pagado:** cadena de oro de farmacia, camioneta con parlantes, asado para 40 desconocidos, Hilux sin
  patente, y el 25 pidiendo fiado. Del bono sale la **4x4**.
- **Arica e inmigración peruana:** los comerciantes son peruanos y el chileno se queja «de los extranjeros» mientras
  compra el pan, almuerza en la picantería y pide fiado. Todos reclaman la propiedad del pisco, el ceviche y el Morro; el
  único que tiene claro de quién es el mar es el abogado de La Haya. La **colonia boliviana** pide mar con maleta y
  salvavidas.
- **Iquique:** la Zofri (un mall de electrodomésticos en el desierto), los **bailes chinos y La Tirana**, el
  parapente, las despedidas de soltero, el «iquiqueño» que insiste que su playa es mejor que la de Arica.
- **San Pedro:** el gringo que paga $15.000 por un completo con «sal del desierto» y lo llama *authentic*; tours a las
  4 AM «para ver el amanecer», cierre a las 9.
- **Humberstone:** el fantasma del salitre y la matanza de Santa María; el turista que se hace selfie sin respeto.
- **Calama:** «la ciudad con la mina más grande del mundo y el menor ingreso por vivienda»; la señora que vende
  empanadas de queso con vista al rajo.
- **Antofagasta:** «la ciudad más cara del país para vivir y la más cara para morir».
- **Los trenes de carga**, las animitas, los perros del desierto que huyen del sol, el que vende «agua» en medio de la
  nada a $5.000.
- **Altiplano:** el soroche (mal de altura) y té de coca; el llamero que no entiende por qué hay tantos turistas;
  los lagos con flamencos que no se dejan ver. **Zofri** y contrabando en la frontera.
- **Centralismo:** *«El cobre es de todos los chilenos, la plata se queda en Santiago»*. El minero lo dice con amargura y
  se compra otra camioneta.

**Subhistorias:** *La Nómina de Pago*, *El Gringo Perdido*, **B:** *La Sal de Altura* (el Chef quiere sal del salar para
su Completo Lab) y *La Llama* (la llama de Anselmo que escapó con sus charquis).

### 4.4 Santiago y sus comunas · Sello 8 · Normal/Lucha

Tres pasadas. **Metro** (Bip!) como viaje rápido.

| Comuna / ruta | Pasada | Nv | Pokémon | Notas |
|---|---|---|---|---|
| Aeropuerto y Terminal Alameda | A/B/C | – | – | Latam, Pullman, Turbus |
| **Estación Central** | A | 28–33 | **Rattata, Meowth, Voltorb**, Magnemite, Koffing, Machop, (Magneton, Persian) | Trenes y barrio comercial |
| **La Pintana** | A | 30–36 | **Rattata, Grimer, Growlithe**, Koffing, Ekans, Zubat, Machop, (Muk, Houndour) | Asaltos y perros |
| **Ñuñoa** | B | 38–44 | **Meowth, Clefairy, Jigglypuff**, Eevee★, Bellsprout, Oddish, Mr. Mime, (Glameow) | Gatos y ciclovías |
| **Providencia / Bellavista** | B | 40–46 | **Hitmonlee, Hitmonchan, Persian**, Machoke, (Porygon) | Carrete |
| **Cerro San Cristóbal** | B | 42–48 | **Pidgeotto, Oddish, Snorlax★**, Growlithe, (Chansey) | Teleférico |
| **Apoquindo (Sanhattan)** | B | 46–56 | **Magnemite, Magneton, Voltorb**, Electrode, Kadabra, (Porygon, Rotom) | Oficinas |
| **Cajón del Maipo** | B | 48–54 | **Geodude, Zubat, Machop**, Pidgeot, Machoke, (Onix) | Cuevas |
| **Lo Barnechea** | C | 56–64 | **Persian, Arcanine, Ninetales**, Rapidash, Kangaskhan★, (Chansey, Gyarados) | Mansiones |
| **Santiago Centro** | C | 60–68 | **Rattata, Meowth, Pidgeot**, Machamp, Hitmonlee, Hitmonchan, (Snorlax) | La Moneda |
| **Costanera Center** | – | 70–80 | Alto Mando y Campeón | Gran Torre |

**Gen 2–4:** Sentret, Furret, Aipom, Dunsparce, Hoothoot, Zigzagoon, Linoone, Slakoth, Spinda, Whismur, Loudred,
Glameow, Purugly, Stunky, Skuntank, Bidoof, Starly, Staravia, Staraptor, Lopunny, Mime Jr., Rotom.

**Líder del gimnasio (La Moneda, Nv 64–68): el Presidente José Antonio Kast.** Tipo Normal/Lucha. Se entra solo con
**audiencia** (7 sellos); antes te mandan a «ventanilla 12». Equipo: Snorlax, Machamp, Tauros, Kangaskhan, Lopunny,
Hitmonlee. Gag: «tiene nueve Pokémon (como sus hijos) pero solo puede sacar seis».
Chiste-ley: se rinde si le dices «orden y seguridad»; lo que nunca cede es la zanja, hasta que te ven cruzar la
frontera del tipo Normal.
**Completo — «El Orden»:** vienesa derecha, perfectamente alineada, tomate, mayonesa y… sin salsas extranjeras; ketchup
solo si es *de marca patria*. («Y ni piensen en meterle chucrut sin papeles».)

**Bromas y estereotipos por comuna**
- **Estación Central:** edificios-guetos, el chileno que se queja de los venezolanos y luego come una arepa «Reina
  Pepiada» (lleva palta, igual que el Italiano: «¿ves? nos parecemos»). Corredores de propiedades, la fila del bus, el
  cobrador que no tiene vuelto, y el arrendador abusivo que arrienda el mismo colchón por turno.
- **La Pintana:** el cuico dice «no vayas, te asaltan» y se va a cometer la **colusión del confort**. Los únicos asaltos
  reales que ves son jóvenes que te piden plata y luego te ayudan a cruzar. El *delito de cuello y corbata* (AFP,
  isapres, pollos, farmacias) es el que de verdad te deja sin nada. Canchas con Alexis y Vidal.
- **Ñuñoa:** ñuñoinos con bicicleta fija, mate vegano y gato. Hablan de lucha social desde el departamento que paga
  el papá. Anti-sistema con tarjeta de crédito, asambleas para elegir el sabor del helado, «completo vegano con tofu»
  (es lo mismo pero más caro), Jorge González en la plaza.
- **Providencia:** el barrio Italia, el Bellavista de las 4 AM, el hombre que vende empanadas a la salida de un local, y
  la señora con 4 perros que «solo la quieren a ella».
- **Apoquindo:** ejecutivos con *sinergias*, coaches, «reunión que pudo ser un correo», el pasante que no cobra, el
  *burnout* con corbata, peleas de **PowerPoint**, tarjetas de casa comercial como villano.
- **Lo Barnechea:** mansiones con piscina que nunca se usa, camioneta eléctrica que no carga, nanas con mejor pasar
  que el dueño. Hablan en inglés para nombrar el pan. Arcanine con apellido compuesto. «El cuico se esconde de la
  crisis… en Zapallar».
- **Santiago Centro:** La Moneda, Paseo Ahumada, cuentistas, el paro, la marcha, el guanaco (carro lanza aguas), la fila
  del cajero. «Todo se decide aquí; el resto del país son provincias». La Plaza de Armas y los ajedrecistas.
- **Metro:** el empujón como mecánica; «cinco minutos de retraso» (45); la línea 1 en hora punta; el que no sale
  nunca del vagón; el artista que canta fuerte. Autopistas con Tag que cobra por existir.
- **Mall:** el Costanera Center que «es el edificio más alto, pero ¿para qué?».
- **Teletón:** Don Francisco recibe a la gente con «¡y colocamos la meta…!» y sube el valor del completo de $1 a $1.000.

**Subhistorias:** *La Audiencia* (tres días de fila para ver a Kast), *El Fiscalizador* (te encuentra en cada comuna),
*La Banda de la Pintana* (se pueden reclutar para el rodeo), *Los Venezolanos del Edificio* (te prestan arepas y te piden
una vienesa a cambio).

### 4.5 Zona Sur · Sello 5 · Fuego

Subzonas: Maule (Talca) · Biobío (Concepción, Lota, Los Ángeles) · Los Ríos (Valdivia) · Araucanía (Pucón, volcán) · Los
Lagos continental (Frutillar, Puerto Varas).

| Ruta | Pasada | Nv | Pokémon | Notas |
|---|---|---|---|---|
| Talca: Alameda y Río Claro | A | 26–31 | **Grimer, Koffing, Voltorb**, Magnemite, Muk, Ditto★, (Electrode, Magneton) | «Radiactiva» |
| Valle del Maule | A | 27–32 | **Ponyta, Tauros, Oddish**, Growlithe, Doduo, Mankey, (Farfetch'd) | Viñas |
| Concepción: Caracol y UdeC | A | 29–35 | **Psyduck, Abra, Machop**, Magnemite, Meowth, Kadabra, (Golduck) | Estudiantes |
| Lota (Chiflón del Diablo) | A | 30–36 | **Zubat, Geodude, Machop**, Koffing, Onix, Gastly, (Golbat) | Carbón |
| Salto del Laja / Los Ángeles | A | 31–37 | **Poliwag, Goldeen, Psyduck**, Poliwhirl, Magikarp, Tentacool, (Gyarados) | Cascadas |
| Valdivia: Feria Fluvial | A | 32–40 | **Seel, Krabby, Poliwag**, Slowpoke, Pidgeotto, Dewgong, (Lapras) | Lobos marinos |
| Pucón: costanera y lago | B | 46–52 | **Persian, Vulpix, Staryu**, Growlithe, Arcanine, Gyarados, (Lapras, Suicune) | Cuicos |
| Huerquehue / Caburgua | B | 48–54 | **Pinsir★, Scyther, Venomoth**, Beedrill, Exeggutor, Primeape, (Tangela, Heracross) | Machete |
| Frutillar y Puerto Varas | B | 48–54 | **Jigglypuff, Chansey, Slowpoke**, Pidgeotto, Bellsprout, Snorlax★, (Azelf) | Kuchen |
| Volcán Villarrica | B | 52–58 | **Ponyta, Magmar, Growlithe**, Geodude, Golem, Vulpix, Rapidash, (Charmeleon, Entei, Heatran) | Cráter |

**Gen 2–4:** Chikorita, Politoed, Swinub, Teddiursa, Ursaring, Heracross, Quagsire, Seedot, Nuzleaf, Zangoose, Cherubi,
Burmy, Wormadam, Gastrodon, Numel, Torkoal.

**Líder (Nv 50–53):** **Don Nicanor «Tizón» Villagrán**, comandante de bomberos voluntarios, quiere apagar el volcán
desde 1987. Equipo: Arcanine, Rapidash, Magmar, Ninetales, Flareon, Charizard.
**Completo — «El Chubasco» (completo mojado):** todo líquido: palta derretida, mayonesa en sopa, ají mojado, vienesa
en caldo y pan que se deshace. Se come con cuchara, bajo la lluvia, **cocinado en lava**.

**Bromas y estereotipos**
- **Lluvia eterna:** paraguas como objeto clave; ropa que nunca se seca; el pan húmedo; el humor del que «ya se
  acostumbró»; el chiste «seco» que nadie entiende.
- **Talca, ciudad radiactiva:** Paciente Cero del COVID (el primer caso de Chile se confirmó ahí), los vecinos con un dedo
  de más, cada enfermedad nueva llega por la Alameda, y todos juran que Talca es la mejor ciudad (y que Talca tiene
  su *Torre Eiffel*, que es un poste). Los completos mojados talquinos se ofrecen con mascarilla.
- **Concepción:** el eterno estudiante, tomas, paros, el Arco de Medicina, los que van a la «u» hace 14 años, Los Bunkers
  y Los Tres en cada esquina, «el puente más largo» que cruza por los cuatro lados.
- **Valdivia:** cerveza alemana, el lobo marino que se roba el pescado y a nadie le importa, la lluvia, el kuchen, los
  alemanes «que llegaron antes» (en 1850).
- **Frutillar:** Teatro del Lago, kuchen a $6.000, la fila para ver el lago «que se ve igual en foto».
- **Pucón:** la Reñaca del sur: camionetas, rafting, el cuico que «es del campo» y nunca ha visto una vaca, el lago
  lleno de lanchas.
- **Forestales:** el pino-monocultivo que arde y alimenta a Moltres. **El conflicto del sur:** hay NPCs que dicen «mejor
  no hablar de eso» y el juego los deja sin respuesta (el chiste es el silencio, no el conflicto).
- **Huaso del sur:** manta de castilla; se queja de que «el del centro no sabe lo que es el frío».
- **Peajes y ruta 5:** el que paga cinco peajes y no tiene ruta 5; los camioneros que paran donde quieren.
- **Alerta roja del volcán:** el cartel «favor de no subir», seguido del grupo de turistas que sube.

**Subhistorias:** *El Primer Caso* (en Talca debes encontrar al paciente cero, que resulta ser un médico que volvió de
viaje y todos lo culpan), *El Kuchen Prohibido* (una alemana de Frutillar no te vende la receta sin resolución sanitaria),
**A:** *Alerta Roja*, **B:** *El Volcán Despierta*.

### 4.6 Rapa Nui · Sello 3 · Planta · **una sola visita antes del 8.º sello** (y regreso en el postgame)

Vuelo en **Latam**. En el aeropuerto el huaso necesita **Tarjeta de Turista**; el carabinero le recuerda que hay un
límite de estadía («para estar acá hay que ser de acá»). Subzonas: Hanga Roa · Tahai · Tongariki y Poike · Rano Raraku ·
Anakena · Ahu Akivi · Rano Kau y Orongo · Motu Nui.

| Ruta | Nv | Pokémon | Notas |
|---|---|---|---|
| Hanga Roa y Tahai | 34–38 | **Ponyta, Doduo, Krabby**, Tentacool, Goldeen, Rapidash, (Farfetch'd) | Caballos y gallinas sueltos |
| Ahu Tongariki / Poike | 36–41 | **Geodude, Graveler, Machop**, Onix, Rhyhorn, Hitmonlee, (Golem, Nosepass★, Probopass★) | 15 moai |
| Rano Raraku | 38–43 | **Geodude, Graveler, Onix**, Cubone, Marowak, Machoke, (Aerodactyl) | Cantera |
| Ahu Akivi / Terevaka | 40–44 | **Exeggcute, Pidgeotto, Doduo**, Oddish, Gloom, Venonat, Tangela | 7 moai |
| Anakena | 40–45 | **Staryu, Shellder, Horsea**, Exeggutor, Krabby, Kingler, Tangela, (Lapras, Luvdisc) | Playa y gimnasio |
| Rano Kau y Orongo | 42–46 | **Psyduck, Golduck, Zubat**, Fearow, Farfetch'd, Poliwag, (Pidgeot) | Cráter |
| Ana Kai Tangata (cueva) | 42–46 | **Zubat, Tentacool, Shellder**, Golbat, Slowpoke, (Tentacruel, Relicanth) | Pinturas |
| Motu Nui (Tangata Manu) | 44–46 | **Tentacool, Seadra, Fearow**, Pidgeot, Farfetch'd, (Manaphy huevo★, Mantine) | Carrera |

**Gen 2–4:** Marill, Hoppip, Sunkern, Bellossom, Corsola, Luvdisc, Relicanth, Wailmer, Lotad, Lombre, Ludicolo, Tropius,
Cacnea, Carnivine, Floatzel, Mantyke, Nosepass, Probopass. **Legendarios solo en el regreso del postgame** (ver 4.6b); en la primera visita el único extra es el huevo de **Manaphy** en el Tangata Manu.

**Líder (Nv 38–42):** **Tía Vaitea Hotu**, cultora y bailarina del Tapati, dueña de la cabaña de Anakena. Equipo: Exeggutor,
Victreebel, Vileplume, Tangela, Venusaur, Parasect.
**Completo — «El Umu»:** horno de tierra: atún fresco, camote, plátano, mayonesa de maracuyá y po'e.

**Bromas y estereotipos**
- **«Los del conti»:** los isleños no quieren mucho a los continentales y se lo dicen. El huaso paga el doble en
  todo («es el precio continental»).
- **El turista** se sube a un moai para la foto: el guardaparques lo baja y el juego aplaude.
- **Todo llega en avión:** una bolsa de cemento vale una casa, un completo $12.000. Latam como monopolio (equipaje
  cobrado, overbooking, «su vuelo se atrasó 6 horas por razones operacionales»).
- **Flores y collares (*hei*):** todo se agradece con flores. **Tapati:** Sau Sau, Ula Ula y *haka pei* (bajar el cerro
  sobre troncos de plátano).
- **Moai:** Nosepass y Probopass son «moai de verdad» (cuando estén). El moai que está de moda «porque tiene gafas de
  sol» y el turista que quiere llevarse una piedra.
- **Visa y estadía:** el huaso necesita un permiso para entrar al país del que es.
- **Centralismo:** «Santiago manda desde 3.700 km».
- **Caballos sueltos:** el que no te deja pasar y que «es el dueño de todo».
- **El pescado:** el atún que llega en jet, el curanto sin curanto, la hamburguesa que cuesta como un auto usado.

**Subhistorias:** *El Collar*, *El Tangata Manu*, *El Turista del Moai*.
**Chef Autor:** construyó un *beach club* con «moais decorativos»; los isleños lo desalojan.

### 4.6b Rapa Nui, regreso del postgame · Nv 70–85

Con los **8 sellos** el huaso recibe un pasaje de Latam «cortesía de la Copa» y el isleño del aeropuerto, ahora sí, lo saluda
(«ya no eres tan del conti… un poquito»). La isla se abre con **rutas nuevas** y **subhistorias de legendarios**.
Todo lo de Rapa Nui del postgame se hace en esta segunda visita.

| Ruta nueva | Nv | Pokémon | Notas |
|---|---|---|---|
| Poike profundo | 70–76 | **Graveler, Golem, Machoke**, Rhydon, Nosepass, Probopass, (Regigigas★) | Cráter de Poike |
| Cueva Ana Te Pahu | 72–78 | **Golbat, Crobat, Onix**, Steelix, Dusclops, Banette, (Giratina) | Tubos de lava |
| Puna Pau (cantera roja) | 72–78 | **Magmar, Magcargo, Rapidash**, Camerupt, Torkoal, (Heatran) | Los «sombreros» |
| Isla Sala y Gómez | 76–84 | **Wailord, Gyarados, Mantine**, Kingdra, Milotic, Lapras, (Kyogre) | Islote deshabitado |
| Te Pito o Te Henua | 80–85 | **Chimecho, Claydol, Lunatone, Solrock**, Gardevoir, Metagross | «El ombligo del mundo» |

**Subhistorias de legendarios (cada una abre con una conversación distinta)**
1. **Los Siete Moai** (Ahu Akivi): los siete moai que miran al mar «no miran al mar, miran hacia adentro». Solo si tienes
   a **Regirock, Regice y Registeel** se abre el sitio y despierta **Regigigas**.
2. **El Huevo del Tangata Manu:** el huevo que traías de la primera visita eclosiona en la caleta y nace **Manaphy**; la
   bahía se llena de **Phione**. Un pescador dice que «siempre fue de nosotros».
3. **La Estrella de Orongo:** durante una lluvia de estrellas, en el cráter de Rano Kau cae **Jirachi**; el astrónomo
   Seba (de Norte Chico) llega en un vuelo de Latam atrasado y se pelea por una foto.
4. **El Ombligo del Mundo:** el camino secreto hasta Te Pito o Te Henua, donde espera **Mew**. Para encontrarlo hay que
   bailar (Sau Sau) hasta que la piedra cante.
5. **El Gran Tapati:** el torneo de la isla (equipos de cada *ahu*, haka pei, canto, baile y batalla). Lo organiza
   Tía Vaitea y el premio, «por única vez en la historia de la isla», es una **MASTER BALL**.

**Master Ball.** Es el premio del **Gran Tapati** (subhistoria 5) y solo se entrega una. En la aventura las bolas se
guardarán como parte del inventario (hoy cada batalla las repone; ese cambio se hará con el inventario).

### 4.7 Chiloé · Sello 6 · Fantasma

Subzonas: Ancud · Castro (palafitos) · Dalcahue · Achao (Quinchao) · Chepu · (B) Cucao y Quicaví.

| Ruta | Pasada | Nv | Pokémon | Notas |
|---|---|---|---|---|
| Ancud y Fuerte San Antonio | A | 48–52 | **Rattata, Pidgeotto, Slowpoke**, Psyduck, Seel, Krabby, Gastly | Niebla |
| Pingüineras de Puñihuil | A | 49–54 | **Seel, Shellder, Tentacool**, Staryu, Dewgong, Kingler, (Lapras, Piplup) | Pingüinos |
| Bosque ahogado de Chepu | A | 50–55 | **Gastly, Zubat, Oddish**, Haunter, Paras, Bellsprout, Tangela | Machete |
| Palafitos de Castro y feria | A | 50–56 | **Pidgeotto, Meowth, Tentacool**, Slowpoke, Magikarp, Psyduck, (Gyarados) | Salmoneras |
| Isla Quinchao: Achao | A | 52–58 | **Gastly, Cubone, Drowzee**, Haunter, Marowak, Hypno | Capillas |
| Cucao: Muelle de las Almas | B | 58–64 | **Gastly, Cubone, Zubat**, Haunter, Marowak, Tentacruel, Duskull, (Gengar★, Darkrai) | De noche |
| Cueva de los Brujos (Quicaví) | B | 60–66 | **Haunter, Hypno, Golbat**, Gengar, Alakazam, Mr. Mime, (Spiritomb, Giratina) | Con invitación |

**Gen 2–4:** Misdreavus, Unown (en las capillas), Murkrow, Qwilfish, Shuppet, Banette, Duskull, Dusclops, Sableye,
Spheal, Lotad, Drifloon, Drifblim, Mismagius, Spiritomb, Gastrodon, Chatot, Rotom.

**Líder (Nv 55–58):** **Don Evaristo Cárcamo**, sacristán de la capilla de Quinchao. **Casi no habla** (sus diálogos son
«Eh», «Ya po», «Mjm», «…»). Gimnasio en una capilla de madera del siglo XVIII. Equipo: Gengar, Haunter, Marowak,
Hypno, Golbat, Gastly.
**Completo — «El Caleuche»:** vienesa ahumada, chapalele, milcao rallado, longaniza chilota, luche y pebre de cochayuyo,
enterrado en hoyo y servido a medianoche.

**Bromas y estereotipos**
- **Lugareños que no hablan:** la información se saca insistiendo; si dices «buenas» te cuentan algo, si no, no. El
  «sí» puede significar no. Hay un NPC que solo responde con el dedo.
- **Mitos:** Trauco (el que se aparece a las mozas y nadie sabe cómo explicar los hijos), Pincoya (anuncia la pesca),
  Caleuche (barco fantasma que se ve al final de cada borrachera), Invunche, los brujos. Aquí todo accidente tiene
  una explicación sobrenatural y nadie la discute.
- **Palafitos y capillas** (Patrimonio de la Humanidad), **mingas** (mover una casa entera con bueyes: minijuego).
- **Salmoneras:** la industria, la marea roja de 2016, el pescador que ya no pesca pero «cuida la balsa». Un Gyarados
  escapado de una salmonera es jefe de ruta.
- **Turismo:** el turista pide «el mito» y el chilote le inventa uno nuevo.
- **Comida:** curanto en hoyo, milcaos, chapaleles y la discusión de «¿lleva carne o mariscos?» que dura más
  que la Guerra del Pacífico.
- **Lluvia y barro:** botas de agua como moda, el ferry que se atrasa porque «hay mar».
- **Los brujos:** el brujo que te cobra IVA, el que tiene Instagram y el que dice que no existe.

**Subhistorias:** *La Minga*, *El Trauco*, *El Barco Fantasma* (el Caleuche solo se ve si has comido curanto),
**B:** *La Cueva* (el brujo mayor te examina) y *El Muelle*.
**Chef Autor:** vende «curanto deconstruido» en un barco; la comunidad lo enfrenta.

### 4.8 Patagonia · Sello 7 · Hielo

Subzonas: Aysén (Coyhaique, Capillas de Mármol, Glaciar Exploradores) · Puerto Natales · Punta Arenas · Torres del
Paine · Tierra del Fuego · Isla Magdalena.

| Ruta | Pasada | Nv | Pokémon | Notas |
|---|---|---|---|---|
| Coyhaique y Carretera Austral | A | 50–54 | **Ponyta, Tauros, Doduo**, Mankey, Primeape, Fearow, (Farfetch'd, Miltank) | Gauchos |
| Capillas de Mármol | A | 52–56 | **Goldeen, Seaking, Golduck**, Seel, Starmie, Cloyster, (Lapras, Uxie) | Lago |
| Puerto Natales y fiordos | A | 53–58 | **Seel, Tentacruel, Psyduck**, Dewgong, Lapras, Gyarados, Cloyster | Navimag |
| Punta Arenas y Fuerte Bulnes | A | 54–60 | **Rattata, Seel, Pidgeotto**, Meowth, Persian, Arcanine, Dewgong | Estrecho |
| Glaciar Exploradores | B | 58–64 | **Seel, Dewgong, Jynx**, Cloyster, Lapras, Snorunt, (Glalie) | Poncho |
| Isla Magdalena / Tierra del Fuego | B | 60–66 | **Seel, Dewgong, Farfetch'd**, Fearow, Ponyta, Cloyster, (Lapras, Walrein) | Pingüinos |
| Torres del Paine: pampa | B | 62–68 | **Tauros, Rapidash, Doduo**, Dodrio, Fearow, Persian, (Pidgeot) | Guanacos |
| Glaciar Grey y Lago Pehoé | B | 64–70 | **Jynx, Dewgong, Cloyster**, Seel, Lapras, Glalie, (Articuno, Regice) | Gimnasio |

**Gen 2–4:** Swinub, Piloswine, Mamoswine, Delibird, Sneasel, Weavile, Smoochum, Snorunt, Glalie, Froslass, Spheal, Sealeo,
Walrein, Snover, Abomasnow, Glaceon, Wingull, Mareep, Flaaffy, Ampharos (corderos), Miltank (vacas).

**Líder (Nv 60–63):** **Don Branko «El Patagón» Radic**, baqueano de estancia. Gimnasio en el refugio frente al Glaciar Grey.
Equipo: Dewgong, Cloyster, Jynx, Lapras, Glalie, Weavile.
**Completo — «El Patagónico»:** **vienesa de cordero**, salsa de calafate, merkén, mayonesa de centolla y pan de la Isla,
$17.990.

**Bromas y estereotipos**
- **Viento:** un NPC se va volando, otro nos pide que le sostengamos el sombrero «por favor». Las puertas que se abren
  solo con el viento. El viento como argumento de todo («no vine porque había viento»).
- **Turistas:** el europeo que paga una noche de hotel con el sueldo de un mes del minero; «is this gluten free?»;
  la entrada al parque se paga en dólares; el que pregunta dónde está «la Patagonia» estando en ella.
- **Gauchos y estancias:** vecinos argentinos con quejas; el «¿tú sí sabes lo que es el frío?».
- **Calafate:** «el que come calafate, vuelve a la Patagonia». El NPC que no quiere volver y no come nada.
- **Aislamiento:** «Magallanes es una isla con pretensiones», el gas que subió, la región abandonada por Santiago,
  el perro que se quedó dormido en medio de la calle 12 años.
- **Punta Arenas:** la Zona Franca, el cementerio más bonito, el Fuerte Bulnes que nadie visita, el estrecho.
- **Puerto Natales:** el *Milodón*, el mercado de la centolla a precio de oro.
- **Tierra del Fuego:** «el fin del mundo» (cartel con foto de turista), el ferry de 2 horas que dura 5.
- **Navimag:** 4 días de ferry entre vacas y mochileros que «ya no hablan de otra cosa».
- **Tomás González** baja del glaciar en cuerda; el guía que dice «es fácil, pero no lo intenten».

**Subhistorias:** *El Calafate*, *La Estancia*, *El Cóndor* y **B:** *El Viento Cambia*.
**Chef Autor:** vende su «completo de cordero deconstruido» a $18.000 y los turistas lo aman.

### 4.9 El Concurso Nacional (Costanera Center) · Nv 70–80

Pisos 1 a 60 del **Gran Torre Costanera** («la torre más alta de Latinoamérica, según el folleto»). Para subir se
necesitan los 8 sellos y haber pagado el estacionamiento.

| Piso | Quién | Receta | Tipo | Equipo (Nv) |
|---|---|---|---|---|
| 1 | **Nonno Beppe Scarpati** | **Italiano** (palta, tomate, mayo) | Planta | 70–72 |
| 2 | **Don Pepe «El Purista»** | **Completo** (la receta «de verdad») | Normal | 71–73 |
| 3 | **Dino «El Dinamitero» Fuentes** | **Dinámico** | Eléctrico | 72–74 |
| 4 | **Anselmo** (¡el rival!) | **Chacarero** (churrasco, porotos verdes, tomate, ají) | Tierra/Lucha | 73–75 |
| Cima | **Vicente «Vichito» Soto, 10 años** | **Pan, vienesa y ketchup** | ?? | 76–80 |

Cada jurado defiende su receta como religión: el purista rechaza la palta, el italiano se queja de que lo llamen
«completo», el dinámico quiere cambiarlo todo y Anselmo dice que lo suyo no es un completo (es un churrasco), «y ni
piensen en discutirlo, que tengo más puestos que ustedes».

**El Campeón.** Vicente tiene 10 años, un récord que nadie verificó y un equipo de 6 que no cabe en una Poké Ball. Su
completo es pan, vienesa y ketchup y **gana la Copa… hasta que el huaso le gana**. A mitad de la batalla lo llama su mamá
a tomar once. Cuando pierde, dice que su completo era mejor «porque me lo hace mi mamá».

**El Chef Autor** intenta sobornar al niño, descalificar a los otros y cambiar las bases. Al final se queda sin nada,
con una espuma de palta en la camisa.

---

## 5. Los legendarios (Gen 1–4) · solo con 8 sellos

Todos en lugares emblemáticos; se pueden buscar antes o después del Concurso.

| Gen | Legendario | Dónde |
|---|---|---|
| 1 | Articuno | Glaciar Pío XI / Campo de Hielo Sur |
| 1 | Zapdos | Volcán Parinacota (tormenta) |
| 1 | Moltres | Lago de lava del Villarrica |
| 1 | Mewtwo | Laboratorio secreto bajo Cochiguaz |
| 1 | Mew | Te Pito o Te Henua, Rapa Nui (postgame) |
| 2 | Raikou | Tormenta del Altiplano (Lauca) |
| 2 | Entei | Volcán Lonquimay / Villarrica |
| 2 | Suicune | Laguna del Laja / Lago Villarrica |
| 2 | Lugia | Cucao, Chiloé |
| 2 | Ho-Oh | Cima del Paine tras la lluvia |
| 2 | Celebi | Alerce Costero (Valdivia) |
| 3 | Regirock | Salar de Atacama |
| 3 | Regice | Glaciar Grey |
| 3 | Registeel | Mina de Chuquicamata |
| 3 | Latias / Latios | Techos de Valparaíso |
| 3 | Kyogre | Fosa frente a Iquique |
| 3 | Groudon | Rajo de Chuquicamata |
| 3 | Rayquaza | Cima del Altiplano |
| 3 | Jirachi | Rano Kau, Rapa Nui (postgame, lluvia de estrellas) |
| 3 | Deoxys | ALMA (Chajnantor) |
| 4 | Uxie / Mesprit / Azelf | Lagos General Carrera, Villarrica y Llanquihue |
| 4 | Dialga / Palkia | Reloj de Plaza Italia / Gran Torre Costanera |
| 4 | Giratina | Cueva de los Brujos (Quicaví) |
| 4 | Heatran | Cráter del Lascar |
| 4 | Regigigas | Ahu Akivi, Rapa Nui (postgame, con los tres Regis) |
| 4 | Cresselia | Valle del Elqui (luna llena) |
| 4 | Darkrai | Muelle de las Almas |
| 4 | Shaymin | Desierto Florido |
| 4 | Arceus | Cima del Aconcagua |
| 4 | Manaphy | Huevo del Tangata Manu (primera visita), nace en el postgame |
| 4 | Phione | Bahía de Hanga Roa (postgame) |

**Regionales de ideas:** Rattata del Altiplano, Mareep de Magallanes, Sandshrew del Salar.

---

## 6. El final

El huaso le gana al niño. Al día siguiente **Cerro Pelado de Abajo sale en todos los noticieros**: el Presidente (Kast)
inaugura una «ruta del completo», Don Francisco lo visita con un camión de cámaras, aparecen 4.000 turistas, un influencer
se hace famoso por sacar una foto del carrito y el pueblo tiene, por primera vez, **señal de celular… en la plaza
entera**. El carrito de Don Eladio tiene fila de 3 horas, Anselmo abre una sucursal de «Churrascos Anselmo®» con
taxis colectivos, y el Chef Autor, derrotado, trabaja de cajero en el carrito (y le dan propina por la espuma). El
abuelo dice, mirando la fila: «ya, ¿y ahora quién me atiende en paz?». Última escena: el huaso en el techo de la iglesia,
donde ahora hay señal, viendo cómo el pueblo se llena. **«Entonces ganamos…».** Créditos con el completo de ketchup.

---

## 7. Postgame

- Legendarios (sección 5), revancha con Chef Autor, Anselmo y Vicente.
- Zonas extra: Cajón del Maipo profundo, ALMA, Alerce Costero, Aconcagua.
- Modo desafío: entrenadores de las rutas con equipos ajustados.

---

## 8. Construcción

1. **Sistema de EXP y niveles.** *(en curso)*
2. Mapa del país con buses/vuelos, banderas de progreso (sellos, objetos clave).
3. Diálogos, NPCs y entrenadores por ruta, objetos de curación chilenos.
4. Rebanada vertical: Zona Centro + Valparaíso A.
5. El resto de zonas, una a una, con sus dos pasadas.
6. Clima y viento, día/noche, minijuegos.
7. Concurso Nacional y postgame.
8. Gen 2–4 en el roster (los datos los pone el usuario).

## 9. Pendiente por decidir
- Qué frases exactas usa cada cameo (las escribo yo y las revisas).
- Si los cameos reales pelean con Pokémon o solo dialogan.
- Lugares de los Pokémon de Gen 2–4 que no aparecen en las tablas (los asigno cuando estén en el roster).
