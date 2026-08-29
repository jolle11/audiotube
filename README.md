# AudioTube 2.0

Extensión de Chrome para escuchar YouTube sin mostrar la imagen del vídeo y reducir distracciones.

La interfaz usa automáticamente el idioma configurado en Chrome. Incluye traducciones en español e inglés; los demás idiomas utilizan inglés como respaldo.

## Instalación local

1. Abre `chrome://extensions` en Chrome.
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida**.
4. Selecciona esta carpeta `AudioTube`.
5. Abre o recarga una pestaña de YouTube.

## Funciones

- Atajo único de concentración: `Ctrl + Shift + Y` en Windows/Linux/ChromeOS y `Command + Shift + A` en macOS. Al activarlo también se activa siempre el modo solo audio. El popup muestra la combinación que Chrome tenga asignada realmente.
- Reproductor compacto con progreso, volumen, velocidad, saltos y anterior/siguiente.
- Calidad mínima inteligente mientras el vídeo está oculto, restaurada al salir.
- Activación automática opcional.
- Ocultar miniaturas.
- Modo concentración: centra el reproductor y oculta navegación, metadatos, recomendaciones, chat y comentarios.
- Perfiles Música, Podcast, Concentración y Sueño.
- Temporizador por minutos, fin del vídeo o fin de la lista, con fundido de volumen y botón `+10 min`.
- Velocidad recordada por canal y saltos configurables de 10, 15 o 30 segundos.

## Nota sobre consumo de datos

AudioTube solicita la calidad de vídeo más baja disponible mientras está activo. Esto puede reducir el consumo, pero YouTube continúa controlando el stream: no se garantiza reproducción de audio separada ni un ahorro concreto de ancho de banda.
