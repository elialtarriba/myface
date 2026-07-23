# Changelog

Todas las novedades, cambios y correcciones de la aplicación "Difuminar" se documentarán en este archivo.

## [1.1.0] - 2026-07-23

### Rediseño Total
- **Interfaz Móvil Nativa (App Style)**: Reemplazo completo de la barra lateral por un sistema de pestañas inferiores (Bottom Navigation Bar) típico de apps como Instagram o Fotos de iOS.
- **Paneles de Herramientas Flotantes**: Las herramientas ahora se agrupan en categorías (Ajustes, IA, Herramientas, Exportar) que se despliegan en un panel translúcido (Glassmorphism) en la parte inferior, dejando la foto visible en tamaño máximo.
- **Paleta de Colores Pastel Premium**: Eliminación de colores fuertes/estridentes. Se han creado nuevos temas pastel auténticos con fondos ultra-claros, sombras muy suaves, bordes redondeados (estilo Apple) y textos en tonos neutros oscuros para máxima legibilidad sin dañar la vista.
- **Pantalla de Inicio V1**: Rediseño de la pantalla de bienvenida con animaciones más sutiles y elegantes.

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
