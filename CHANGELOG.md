# Changelog

Todas las novedades, cambios y correcciones de la aplicación "Difuminar" se documentarán en este archivo.

## [1.0.0] - 2026-07-23

### Añadido
- **Estructura Base**: Creación de `index.html`, `style.css` y `app.js` con una interfaz de usuario premium (modo oscuro, glassmorphism).
- **Herramientas IA (Google MediaPipe)**:
  - Difuminar Fondo: Uso del modelo Selfie Segmenter para separar el sujeto del fondo.
  - Quitar Arrugas: Uso del modelo Face Landmarker para detectar rostros y aplicar suavizado en el área de la piel.
- **Ajustes Globales (Canvas 2D)**: Iluminación, Contraste, Temperatura y Blanco y Negro.
- **Herramientas Manuales**:
  - Tampón de clonar (Alt+Click para origen).
  - Pincel de Iluminación (Fusión Color Dodge).
- **Herramienta de Recorte**: Recuadro interactivo con opciones de proporción (Libre, 1:1, 16:9, 4:3).
- **Opciones de Exportación**: Guardado en formatos PNG (sin pérdida), JPEG o WebP, con control de compresión/calidad, y soporte para copiar al portapapeles.
- **Selector de Temas**: Opciones de temas con colores pastel y "blanquecito" que modifican la apariencia en tiempo real.
- **Modo PWA y Offline**: Descarga de recursos y modelos locales, creación de `manifest.json` y Service Worker (`sw.js`) para uso sin conexión a internet e instalación de la app.
- **Soporte Táctil y Móvil**: Adaptación completa de las herramientas manuales para pantallas táctiles (uso de dedos) y rediseño Responsive para móviles e iPads (uso de `100dvh`).
- **Pantalla de Bienvenida (Splash Screen)**: Pantalla inicial animada con el logo y número de versión (V1) al entrar en la aplicación.

### Corregido
- **Rendimiento de IA en Móviles**: Se ha implementado un sistema de redimensionado automático (máximo 1920px) al cargar fotos de alta resolución (como las de un iPhone). Esto evita bloqueos por falta de memoria y hace que la IA procese la imagen casi instantáneamente.
- **Visibilidad de Menús en Móviles**: Corrección del cálculo de la barra de desplazamiento en la barra de herramientas para evitar que las opciones desaparezcan al usar la app en horizontal/vertical o con la barra de Safari.
