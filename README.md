# ⚽ SuperSoccer

Videojuego de **fútbol chileno en 3D** que se juega en el navegador, con **mando** (Xbox, PlayStation o genérico) o teclado.
Incluye los 16 clubes de la **Liga de Primera 2026**, Campeonato Nacional, Copa Chile, amistosos, tanda de penales,
partidos de día, atardecer y noche, lluvia, repeticiones de goles y relato con modismos chilenos.

> Todos los jugadores son **ficticios** y los emblemas son **diseños originales** (no se usan escudos ni logos oficiales).

---

## 🎮 Cómo jugar

1. Abre el juego en el navegador (Chrome, Edge o Firefox actualizados).
2. Conecta un mando por USB o Bluetooth y **presiona cualquier botón**: aparecerá un aviso "Mando conectado".
3. En el menú elige un modo:
   - **Amistoso**: eliges los dos clubes, el estadio, la hora (día, atardecer, noche), el clima (despejado o lluvia), la duración y la dificultad.
     En "Jugadores" decides qué equipo maneja cada mando: así juegas **1 contra CPU**, **1 contra 1** (dos mandos en equipos distintos)
     o **cooperativo 2 contra CPU** (dos mandos en el mismo equipo).
   - **Campeonato Nacional**: liga de 30 fechas (ida y vuelta) con tabla, goleadores y resultados de las otras canchas. Se guarda solo.
   - **Copa Chile**: llaves de eliminación directa; si hay empate, se define a penales.
   - **Tanda de penales**: modo rápido.
4. En la pantalla de pausa (botón Start/Options o Esc) puedes cambiar cámara, formación, opciones y controles.

## 🕹️ Controles

| Acción | Xbox | PlayStation | Teclado |
|---|---|---|---|
| Moverse | Stick izquierdo / cruceta | Stick izquierdo / cruceta | Flechas |
| Pase (en defensa: entrada) | A | ✕ | A |
| Tiro (mantener = más potencia) · en defensa: barrida | B | ○ | D |
| Pase largo / centro | X | □ | S |
| Pase filtrado | Y | △ | W |
| Cambiar de jugador | LB | L1 | Q |
| Correr | RT | R2 | Shift izq. |
| Proteger el balón | LT | L2 | E |
| Regate (con balón) / mover cámara | Stick derecho | Stick derecho | I J K L |
| Cambiar cámara (TV, cercana, aérea) | View | Share | C |
| Pausa | Menu | Options | Esc |

- **Barra de potencia**: al mantener Tiro o Pase largo aparece una barra; suelta para patear.
- Sin balón y con tu equipo atacando: **A** pide el pase, **Y** pide un pase filtrado.
- En defensa: **mantener A** presiona automáticamente al rival; **X** pide a un compañero que presione.
- Los sticks tienen **zona muerta** para evitar movimientos fantasma. El mando **vibra** con goles, tiros fuertes y entradas (si lo soporta).
- En **Controles** puedes reasignar cualquier botón o tecla (se guarda en el navegador).
- Los menús se recorren enteros con el mando: cruceta o stick para moverse, **A** para elegir, **B** para volver.

## 💻 Cómo correrlo en tu computador

Necesitas tener instalado **Node.js 18 o superior** (descárgalo desde https://nodejs.org, versión "LTS").

```bash
git clone https://github.com/jorge733/SuperSoccer.git
```

```bash
cd SuperSoccer
```

```bash
npm install
```

```bash
npm run dev
```

Luego abre en el navegador la dirección que aparece (normalmente http://localhost:5173).
Para probar la versión final optimizada:

```bash
npm run build
```

```bash
npm run preview
```

## 🚀 Cómo publicarlo gratis en Vercel

No necesita servidor: es una página estática.

**Opción fácil (sin programar):**
1. Entra a https://vercel.com e inicia sesión con tu cuenta de GitHub.
2. Presiona **Add New… → Project** y elige el repositorio **SuperSoccer**.
3. Vercel detecta solo que es un proyecto **Vite**. Deja los valores por defecto:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Presiona **Deploy**. En un par de minutos tendrás un enlace del tipo `https://supersoccer-xxxx.vercel.app`.
5. Cada vez que se suban cambios a la rama `main`, Vercel vuelve a publicar automáticamente.

**Opción por consola:**

```bash
npm i -g vercel
```

```bash
vercel --prod
```

## ⚙️ Calidad gráfica y rendimiento

- Al iniciar, el juego **detecta tu tarjeta gráfica** y elige una calidad (en tablets usa "Baja").
- En **Opciones → Calidad gráfica** puedes elegir **Automática, Baja, Media, Alta o Ultra**. Cambia: resolución, sombras,
  oclusión ambiental (SSAO), bloom, antialiasing, cantidad de público, gotas de lluvia y simulación de redes.
- En modo Automático, si los FPS bajan de 40 por varios segundos, el juego baja un nivel solo.
- Puedes activar **Mostrar FPS** en Opciones.

## ✏️ Editar clubes y jugadores

Todos los datos están en **`src/data/clubes.json`**: nombre, ciudad, estadio, nivel, colores de la camiseta titular y alternativa
(con diseño: `liso`, `franjas`, `franjasFinas`, `banda`, `aros`, `diagonal`, `mitades`, `centro`), forma y diseño del emblema, y el plantel
(nombre, dorsal, posición, atributos de velocidad, tiro, pase, regate, defensa, físico y arquero, y apariencia: altura, contextura,
tono de piel, color y estilo de pelo, barba).

Para regenerar planteles ficticios nuevos: `npm run datos` (sobrescribe el archivo).

## 🗂️ Estructura del proyecto

```
index.html            Página del juego
public/hdri/          Cielos HDRI (Poly Haven, CC0)
src/main.js           Arranque, pantalla de carga y bucle principal
src/core/             Render y post-procesado, calidad gráfica, controles (Gamepad API + teclado), ajustes
src/world/            Estadio, cancha, redes con tela simulada, público con instancing, clima/luces, balón y física (Rapier)
src/players/          Modelo humano con esqueleto, animaciones con mezcla y camisetas generadas por código
src/game/             Partido (reglas), IA, control humano, cámaras, repeticiones, relato, formaciones
src/modes/            Campeonato Nacional y Copa Chile
src/ui/               Menús, HUD (marcador, radar, potencia) y emblemas
src/audio/            Sonido generado con Web Audio API
src/data/clubes.json  Datos editables de clubes y jugadores
scripts/              Generador de planteles ficticios
```

## 🧱 Tecnologías

- [Three.js](https://threejs.org) (MIT) — motor 3D, iluminación PBR, sombras, post-procesado (GTAO/SSAO, bloom, SMAA/FXAA).
- [Rapier](https://rapier.rs) (Apache 2.0) — física del balón, palos, travesaños, redes y cuerpos de los jugadores.
- [Vite](https://vitejs.dev) (MIT) — compilación y servidor de desarrollo.

## 📜 Recursos de terceros y licencias

| Recurso | Autor / Fuente | Licencia | Uso |
|---|---|---|---|
| HDRI "Quarry 01" | Poly Haven, vía repositorio de ejemplos de three.js | **CC0** | Cielo e iluminación de día |
| HDRI "Venice Sunset" | Poly Haven, vía repositorio de ejemplos de three.js | **CC0** | Atardecer |
| HDRI "Moonless Golf" | Poly Haven, vía repositorio de ejemplos de three.js | **CC0** | Noche |
| Three.js + addons | mrdoob y colaboradores | MIT | Motor 3D |
| Rapier (`@dimforge/rapier3d-compat`) | Dimforge | Apache 2.0 | Física |

**Modelos, animaciones, texturas y sonidos propios (generados por código, sin licencias de terceros):**

- **Jugadores, árbitros y público**: modelos humanos generados por código (`src/players/humano.js`) con un esqueleto de 17 huesos.
  Las animaciones (trotar, correr, pasar, tirar, cabecear, barrer, caer, celebrar, atajar, lanzarse, saque de banda, etc.) son
  procedurales (`src/players/animacion.js`), se mezclan suavemente y la pisada se sincroniza con la distancia recorrida para que los pies no patinen.
  *¿Por qué no Mixamo?* Mixamo exige iniciar sesión con una cuenta de Adobe para descargar y su licencia no permite redistribuir los
  archivos sueltos en un repositorio público; por eso se optó por modelos propios, libres de restricciones.
- **Estadio** (cancha, líneas de cal, arcos, redes, graderías, techo, torres de iluminación, bancas, pantalla gigante, vallas LED): generado por código.
- **Texturas** (pasto con franjas de corte y desgaste, balón de 32 paneles, camisetas con número y nombre, redes, vallas): dibujadas por código en canvas.
- **Emblemas**: diseños originales con las iniciales y colores de cada club (no son escudos oficiales).
- **Sonidos** (silbato, patadas, palo, red, público, "uuuh", abucheos, cánticos): sintetizados en vivo con Web Audio API.

> Nota técnica: como todos los modelos y texturas se generan en el navegador, el juego no necesita descargar archivos GLB ni KTX2
> (lo que lo hace cargar muy rápido). Los únicos archivos pesados son los tres HDRI (≈1,5 MB cada uno).

## ✅ Estado y limitaciones conocidas

- La IA juega por formación, presiona, marca, hace desmarques al espacio, centra, remata y el arquero ataja o se lanza según su atributo.
- El arquero siempre lo maneja la CPU durante el partido (en la tanda de penales puedes manejarlo tú).
- Los gráficos apuntan a 60 FPS en calidad Media en un computador normal; en equipos modestos usa Baja.
