# Sistema de Expedientes de Salud Ocupacional — ASADA Bijagua de Upala

Sistema web oficial para el registro, consulta y gestión de expedientes clínicos y de salud ocupacional del personal de la **ASADA Bijagua de Upala** (fontaneros, mantenimiento y personal administrativo).

Todos los datos se guardan y consultan en tiempo real en la base de datos **Google Cloud Firebase Firestore**.

---

## 🚀 1. Credenciales de Acceso

| Rol / Función | Método de Ingreso | Credencial Predeterminada |
| :--- | :--- | :--- |
| **Colaborador / Trabajador** | Cédula + Contraseña elegida | Se registra en `registro-trabajador.html` |
| **Administración** | Contraseña de acceso en `admin.html` | `admin123` |
| **Acceso Rápido de Emergencia** | Botón rojo "Acceso Emergencia" en cualquier página | Código: `9119` |

---

## 🗄️ 2. Base de Datos Firebase Firestore

- **Proyecto Firebase:** `asadabijaguaclinica`
- **Colección Principal:** `trabajadores`
  - Cada documento tiene como ID el número de **cédula** del trabajador.
  - Campos almacenados:
    - `cedula`: Número de identificación (9 a 12 dígitos).
    - `nombre`: Nombre completo del colaborador.
    - `puesto`: Puesto o área de trabajo (fontanería, mantenimiento, etc.).
    - `telefono`: Teléfono de contacto.
    - `passHash`: Hash criptográfico SHA-256 de la contraseña (seguro).
    - `consentimiento`: Autorización de tratamiento de datos según Ley 8968.
    - `aptitud`: Evaluación de aptitud laboral (`Apto`, `Apto con restricciones`, `No apto`, `Sin evaluar`).
    - `expediente`: Objeto completo con residencia (provincia, cantón, distrito, dirección), 2 contactos de emergencia, grupo sanguíneo, vacunas (tétanos), EBAIS, alergias, enfermedades crónicas, medicamentos, cirugías, riesgos laborales (espacios confinados, alturas, químicos) y seguros (CCSS, INS).
- **Colección de Auditoría:** `bitacora` (registra accesos, altas y modificaciones).

### Reglas de Seguridad (`firestore.rules`)
Para publicar las reglas en Firebase Console:
1. Ingrese a [Firebase Console](https://console.firebase.google.com/) > Proyecto **asadabijaguaclinica**.
2. Vaya a **Firestore Database** > pestaña **Reglas** (Rules).
3. Pegue el contenido del archivo `firestore.rules` y haga clic en **Publicar** (Publish).

---

## 📂 3. Estructura de Archivos

- **`index.html`**: Página principal institucional y bienvenida.
- **`registro-trabajador.html`**: Formulario de auto-registro para colaboradores (Cédula, nombre, puesto, teléfono, contraseña y consentimiento informado).
- **`login-trabajador.html`**: Inicio de sesión del colaborador mediante su Cédula y contraseña.
- **`expediente-form.html`**: Formulario clínico integral con barra de avance porcentual en vivo, cascada territorial de Costa Rica y guardado directo en Firestore.
- **`admin.html`**: Panel administrativo con estadísticas en tiempo real, búsqueda y filtros (sangre, alergias, restricciones), evaluación rápida de aptitud laboral, exportación a Excel (CSV) e impresión por lote.
- **`emergencia.html`**: Planilla de atención médica inmediata para emergencias con teléfonos de llamada directa (`tel:`), alergias críticas, contactos y fichas.
- **`expediente.html`**: Generador de **Ficha Médica Oficial** imprimible y **Tarjeta de Bolsillo de Emergencia** (permite imprimir o guardar directamente como PDF).
- **`firebase-config.js`**: Módulo central de inicialización y funciones auxiliares para Firestore.
- **`app.js`**: Controlador de lógica, navegación, accesibilidad y eventos de interfaz.
- **`estilos.css`**: Hoja de estilos moderna, institucional, responsiva y con soporte de impresión y alto contraste.
- **`logo.jpg` / `logo.png`**: Logotipo oficial de la ASADA Bijagua.

---

## 💻 4. Cómo Probar y Ejecutar la Web

Dado que la aplicación utiliza módulos modernos de JavaScript (`<script type="module">`) para comunicarse directamente con Firebase Firestore, debe servirse a través de un servidor web local o servicio de hosting (no directamente mediante doble clic en `file://`).

### Opción A: Servidor local rápido con Python (en Mac o Windows)
Abra una terminal en esta carpeta y ejecute:
```bash
python3 -m http.server 8080
```
Luego abra en su navegador:
👉 **`http://localhost:8080`**

### Opción B: Publicación en Línea (Gratis)
Puede subir estos archivos directamente a:
- **GitHub Pages**
- **Vercel**
- **Netlify**
- **Firebase Hosting**:
  ```bash
  firebase deploy
  ```

---

## ✅ 5. Flujo de Prueba Recomendado

1. Abra `index.html`.
2. Vaya a **Crear Cuenta** (`registro-trabajador.html`):
   - Cédula: `201230456`
   - Nombre: `Carlos Mora Vargas`
   - Puesto: `Fontanero Operativo`
   - Teléfono: `8888-1234`
   - Contraseña: `1234`
   - Acepte el consentimiento y presione **Crear Cuenta**.
3. El sistema lo redirigirá inmediatamente a **`expediente-form.html`**:
   - Complete la residencia (Alajuela > Upala > Bijagua), contactos de emergencia, tipo de sangre (ej: `O+`), vacunas y alergias.
   - Presione **Guardar Expediente**.
4. Haga clic en **Ver Mi Ficha Oficial** para ver la ficha lista para imprimir o guardar como PDF.
5. Vaya a **Administración** (`admin.html`):
   - Ingrese con la contraseña `admin123`.
   - Verifique que el nuevo colaborador aparece en la tabla con sus estadísticas actualizadas.
   - Pruebe la descarga a Excel con el botón **Descargar Excel (CSV)**.
