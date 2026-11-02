# AudioTube 2.1

Extensión de Chrome y Firefox para escuchar YouTube y YouTube Music sin mostrar la imagen del vídeo y reducir distracciones.

La interfaz usa automáticamente el idioma configurado en Chrome. Incluye traducciones en español e inglés; los demás idiomas utilizan inglés como respaldo.

## Instalación local

1. Abre `chrome://extensions` en Chrome.
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida**.
4. Selecciona esta carpeta `AudioTube`.
5. Abre o recarga una pestaña de YouTube.

## Firefox

1. `npm install && npm run build` genera `dist/chrome` y `dist/firefox`.
2. En Firefox abre `about:debugging#/runtime/this-firefox` → **Cargar complemento temporal** y elige `dist/firefox/manifest.json`.
3. Firefox trata los permisos de sitio de MV3 como opcionales: concede el acceso a YouTube desde `about:addons` → AudioTube → Permisos.

## Desarrollo

- `npm run lint`, `npm test` (unitarios), `npm run test:e2e` (Playwright: carga la extensión real en Chromium contra páginas falsas de YouTube) y `npm run build`; la CI de GitHub Actions los ejecuta todos.
- Los iconos salen de `icons/icon.svg`; tras editarlo, `npm run icons` regenera los PNG.
- Si YouTube cambia su HTML y algún selector deja de encontrar el vídeo, el reproductor o el canal, AudioTube lo avisa una vez en la consola de la pestaña (`AudioTube: no se encuentra …`).
- El content script está dividido en `content/util.js` (funciones puras, con tests), `state.js` (almacenamiento), `timer.js`, `player.js` (reproductor compacto, Media Session, posición) y `main.js` (modos, mensajes y navegación).

## Funciones

- Atajo único de concentración: `Ctrl + Shift + Y` en Windows/Linux/ChromeOS y `Command + Shift + A` en macOS. Al activarlo también se activa siempre el modo solo audio. El popup muestra la combinación que Chrome tenga asignada realmente; si no hay ninguna, se configura en `chrome://extensions/shortcuts`.
- Reproductor compacto con progreso, volumen, velocidad, saltos y anterior/siguiente.
- Calidad mínima inteligente mientras el vídeo está oculto, restaurada al salir.
- Activación automática opcional.
- Ocultar miniaturas.
- Modo concentración: centra el reproductor y oculta navegación, metadatos, recomendaciones, chat y comentarios.
- Perfiles Música (salto de 10 s), Podcast (oculta miniaturas, salto de 30 s y retomar posición), Concentración y Sueño (concentración + temporizador de 30 min con fundido).
- Media Session: título, canal y carátula en la pantalla de bloqueo, teclas multimedia y auriculares, con saltos según el salto rápido configurado.
- Compatible con YouTube Music y Shorts (en Shorts se oculta la imagen y se mantiene la interfaz de YouTube).
- Regla por canal: «Solo audio siempre en este canal» desde el popup.
- Retomar vídeos largos (20 min o más) donde se dejaron, salvo que la URL incluya `t=`.
- Durante los anuncios se muestran los controles de YouTube para poder saltarlos.
- Temporizador por minutos, fin del vídeo o fin de la lista, con fundido de volumen y botón `+10 min`, visible también en el reproductor compacto. Al terminar se restaura el volumen, y si se desactivó la reproducción automática se reactiva al reproducir el siguiente vídeo.
- Velocidad recordada por canal (en `storage.local`, con un máximo de 500 canales) y saltos configurables de 10, 15 o 30 segundos.

## Nota sobre consumo de datos

AudioTube solicita la calidad de vídeo más baja disponible mientras está activo. Esto puede reducir el consumo, pero YouTube continúa controlando el stream: no se garantiza reproducción de audio separada ni un ahorro concreto de ancho de banda, y YouTube puede ignorar la petición en algunos vídeos.
