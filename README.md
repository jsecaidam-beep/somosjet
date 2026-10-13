# Somos JET

Sitio oficial de Juventudes en Expansión Territorial, Guatemala.

Publicado en https://somosjet.me mediante GitHub Pages desde la raíz de `main`.

## Estructura

- `index.html`: secciones, metadatos y catálogo público de publicaciones.
- `styles.css`, `motion.css`, `posts.css`, `form.css`: diseño, movimiento, galería y formulario.
- `app.js`: menú, entradas y escena de Liquid Glass.
- `posts.js`: filtros y navegación de los ocho carruseles (66 imágenes) y el reel.
- `form.js`: envío al receptor de Google Apps Script y confirmación del guardado dentro de la landing.
- `territory.js`, `territory.css`: mapa SVG con la presencia territorial oficial de JET.
- `icons.css`, `assets/icons.svg`: iconos vectoriales locales de Lucide, sin emojis.
- `assets/`: fuentes, logo, valores vectoriales, biblioteca LiquidGlass y fotografías.
- `google-apps-script.js`: fuente del receptor JET v2; se despliega por separado en Apps Script.
- `tests/`: pruebas de confirmación, errores, reintentos y presencia oficial del mapa.

## Vista local

Ejecutar `python3 -m http.server 8765` desde esta carpeta y abrir http://127.0.0.1:8765.

## Formulario

Se conservan nombre, correo, municipio opcional, cuatro intereses y consentimiento;
el departamento es una selección de los 22 departamentos de Guatemala.

El envío POST ocurre en segundo plano. Su respuesta opaca no se considera una
confirmación: la landing consulta un comprobante de guardado mediante GET JSONP
con un UUID aleatorio. El receptor valida los datos, bloquea escrituras concurrentes,
evita duplicados del mismo intento y responde solo después de guardar la fila.
Los reintentos conservan los datos y el UUID. El agradecimiento y los brillos SVG
aparecen únicamente al confirmar el registro.

La hoja conserva sus columnas A:D y agrega E:I para interés, mensaje, consentimiento,
ID de registro y departamento. La consulta pública devuelve únicamente la confirmación del intento mediante su
UUID aleatorio y el departamento de ese intento; no publica cifras de participantes,
categorías, nombres, correos ni mensajes.

Para actualizar el receptor, editar Code.gs en el proyecto vinculado a la hoja y
actualizar la implementación existente a una nueva versión. Publicar este archivo
en GitHub Pages no cambia automáticamente Apps Script. La URL del receptor se
conservó; JET v2 está activo desde el 12 de octubre de 2026.

## Mapa

El mapa marca en fucsia los territorios de presencia indicados por JET: Petén,
Chiquimula, Jalapa, Izabal (incluye Puerto Barrios), Huehuetenango, Suchitepéquez,
Retalhuleu, Sololá, Sacatepéquez, Guatemala, Jutiapa, El Progreso y Quetzaltenango.

Muestra solo los nombres de departamentos y la presencia de JET. No contiene
contadores, datos de ejemplo ni puntos individuales. Un registro confirmado
puede animar una región ya presente; registrarse desde otro departamento no
modifica la presencia oficial de JET.

La geometría local de los 22 departamentos procede de geoBoundaries / William & Mary
con origen OpenStreetMap (ODbL); la atribución se conserva en el mapa y en el JSON.

## Validación

`node --test tests/signup-backend.test.cjs` comprueba guardado, idempotencia,
validación, privacidad y errores. `node tests/signup-client.test.cjs` comprueba que
solo un recibo guardado confirma el envío, los reintentos y la confirmación en la landing.
`node --test tests/territory-presence.test.cjs` comprueba la presencia oficial y
que las inscripciones no amplían automáticamente el mapa.
También se verificó el flujo real con registros temporales retirados tras la prueba.

## Diseño y fuentes

Los iconos locales de Lucide conservan sus licencias ISC/MIT en `LICENSE-lucide.txt`.
Tres familias locales: DM Sans, Space Grotesk y Modak. Liquid Glass usa
`@ybouane/liquidglass` 1.0.3 (MIT); su importación sólo afecta a la escena de portada.
La preferencia de movimiento reducido desactiva las animaciones y usa vidrio CSS.
Los carteles de valores conservan las letras trazadas de la identidad gráfica de JET.
Las imágenes de publicaciones tienen enlaces a sus fuentes y créditos en el catálogo.

No hace falta publicar el HTML portátil de la propuesta: en producción los recursos
se cargan por separado y las imágenes de la galería se cargan según se necesitan.
