# JET — Landing web

Landing estática preparada para publicar con GitHub Pages.

## Publicar

1. Sube estos archivos a un repositorio de GitHub.
2. En **Settings → Pages**, elige desplegar desde la rama principal y la carpeta raíz.
3. Configura `somosjet.me` como dominio personalizado. El archivo `CNAME` ya está incluido.
4. En el proveedor DNS de `somosjet.me`, apunta el dominio a GitHub Pages según las instrucciones que GitHub mostrará al activar Pages.

## Newsletter y Google Sheets

El formulario está preparado para enviar nombre, correo, municipio/departamento, interés, mensaje y consentimiento a un Web App de Google Apps Script. El HTML de referencia de Gemini no incluía esta integración: solo mostraba una alerta.

1. Crea una hoja de Google Sheets con estas columnas: Fecha, Nombre, Correo, Municipio, Interés, Mensaje y Consentimiento.
2. Abre **Extensiones → Apps Script**, reemplaza el contenido por [google-apps-script.js](google-apps-script.js) y guarda.
3. En **Implementar → Nueva implementación**, selecciona **Aplicación web** y da acceso a **Cualquier persona**.
4. Copia la URL publicada (empieza con `https://script.google.com/macros/s/...`) y pégala en `data-sheet-url` del formulario dentro de `index.html`.

No uses el botón ▶︎ para probar `doPost`: esa ejecución no contiene datos del formulario. En su lugar, después de desplegar, abre la URL del Web App en el navegador para comprobar que responde correctamente. Sin esa URL publicada, un sitio en GitHub Pages no puede escribir en la hoja de forma segura.
