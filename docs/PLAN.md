# Plan de SuperSoccer

## Decisiones técnicas
- **Three.js** (motor 3D) + **Rapier** (física real del balón, palos, travesaño, redes y cuerpos de los jugadores).
- **Vite** para compilar. El resultado es una carpeta estática (`dist/`) que se publica gratis en Vercel. No hay servidor.
- Los jugadores, el estadio, el público, el balón y las camisetas se **generan por código** (modelos procedurales). Así no dependemos de cuentas (Mixamo pide inicio de sesión con Adobe y no se puede descargar automáticamente) ni de licencias dudosas, y el juego carga muy rápido.
- Iluminación con **mapas HDRI de Poly Haven (CC0)**.
- Sonido generado en vivo con **Web Audio API** (sin archivos de audio, libre de derechos).

## Estructura de carpetas
```
index.html            Página del juego
public/hdri/          Cielos HDRI (Poly Haven, CC0)
src/main.js           Arranque, pantalla de carga y flujo de pantallas
src/core/             Render, calidad gráfica, controles (mando/teclado), utilidades
src/world/            Estadio, cancha, arcos y redes, público, clima, balón, física
src/players/          Modelo humano 3D, animaciones y camisetas
src/game/             Partido: reglas, IA, cámaras, repeticiones, árbitro, relato
src/modes/            Campeonato, Copa Chile, penales
src/ui/               Menús y HUD (marcador, radar, barra de potencia)
src/audio/            Sonidos (silbato, patadas, público, cánticos)
src/data/clubes.json  Clubes, estadios, colores y planteles (editable)
scripts/              Generador de planteles ficticios
```

## Etapas
a. Estadio 3D, cámara, un jugador animado y balón con física, controlado con mando.
b. Partido completo 11 contra 11 contra la CPU (reglas, IA, arquero, árbitro).
c. Clubes, camisetas, emblemas y menús.
d. Modos Campeonato Nacional y Copa Chile (y penales).
e. Pulido gráfico (luz, clima, público, repeticiones), sonido y optimización.
