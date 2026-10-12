# Somos JET

Sitio oficial de Juventudes en Expansión Territorial, Guatemala.

Publicado en https://somosjet.me mediante GitHub Pages desde la raíz de `main`.

## Estructura

- `index.html`: secciones, metadatos y catálogo público de publicaciones.
- `styles.css`, `motion.css`, `posts.css`, `form.css`: diseño, movimiento, galería y formulario.
- `app.js`: menú, entradas y escena de Liquid Glass.
- `posts.js`: filtros y navegación de los ocho carruseles (66 imágenes) y el reel.
- `form.js`: envío al receptor vigente de Google Apps Script, con respuesta en nueva pestaña.
- `assets/`: fuentes, logo, valores vectoriales, biblioteca LiquidGlass y fotografías.
- `google-apps-script.js`: referencia del receptor existente; no se despliega mediante Pages.

## Vista local

Ejecutar `python3 -m http.server 8765` desde esta carpeta y abrir http://127.0.0.1:8765.

## Formulario

Se conservaron los campos, cuatro intereses y consentimiento. El POST nativo abre
la respuesta real del receptor y mantiene los datos en pantalla. No se interpreta
un fetch opaco como prueba de que se guardó el registro.

## Diseño y fuentes

Tres familias locales: DM Sans, Space Grotesk y Modak. Liquid Glass usa
`@ybouane/liquidglass` 1.0.3 (MIT); su importación sólo afecta a la escena de portada.
La preferencia de movimiento reducido desactiva las animaciones y usa vidrio CSS.
Los carteles de valores conservan las letras trazadas de la identidad gráfica de JET.
Las imágenes de publicaciones tienen enlaces a sus fuentes y créditos en el catálogo.

No hace falta publicar el HTML portátil de la propuesta: en producción los recursos
se cargan por separado y las imágenes de la galería se cargan según se necesitan.
