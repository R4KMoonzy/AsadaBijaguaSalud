# Guía: configurar Appwrite para los documentos de solicitudes

Firestore guarda las solicitudes (estado, fechas, comentarios). Appwrite guarda solo los archivos (PDF/imágenes).
No necesita API keys ni nada secreto: solo 3 datos públicos.

## 1. Crear el proyecto
1. Cree una cuenta en https://cloud.appwrite.io
2. **Create project** → nombre: `ASADA Salud` → elija región.
3. En **Settings** del proyecto copie: **Project ID** y **API Endpoint** (ej. `https://cloud.appwrite.io/v1` o uno con región, como `https://fra.cloud.appwrite.io/v1`).

## 2. Autorizar su sitio web (evita errores CORS)
1. En el proyecto: **Overview → Integrations → Platforms → Add platform → Web**.
2. Hostname: `localhost` (para pruebas). Repita para su dominio real, ej. `tuusuario.github.io` o `asada-bijagua.web.app` (sin `https://` ni rutas).

## 3. Crear el bucket
1. **Storage → Create bucket** → Nombre: `documentos-solicitudes`.
2. Abra el bucket → **Settings**:
   - **Permissions → Add role → Any** → marque **Create** y **Read**.
   - **File security**: desactivado.
   - **Maximum file size**: 5 MB (5000000 bytes).                                                    6af338d5000938ee0839.   /.   https://nyc.cloud.appwrite.io/v1
   - **Allowed file extensions**: `pdf, jpg, jpeg, png, webp`.     
   - **Encryption**: activado.
3. Copie el **Bucket ID** (aparece en Settings del bucket).

## 4. Conectar la app
Edite `appwrite-config.js` y reemplace `projectId`, `bucketId` (y `endpoint` si el suyo es regional).

## 5. Probar
1. Ingrese como colaborador → **Mis Solicitudes** → cree una Incapacidad con un PDF.
2. Verifique el archivo en Appwrite → Storage → su bucket.
3. Ingrese a `admin.html` → **Solicitudes** → seleccione al colaborador → Autorizar/No autorizar con comentario y documento.
4. Vuelva a la cuenta del colaborador: el estado se actualiza en vivo.

## Nota de seguridad
Igual que el resto del sistema (reglas Firestore abiertas), cualquiera que tenga el enlace exacto de un archivo puede abrirlo. Los certificados médicos son datos sensibles (Ley 8968): más adelante conviene migrar a Firebase Authentication + reglas por usuario y archivos con permisos por usuario.
jpeg
webp
jpg
png
gif
pdf
doc
docx
xls
xlsx
zip, mp4