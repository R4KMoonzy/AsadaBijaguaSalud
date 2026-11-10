// Almacenamiento de documentos en Appwrite (los metadatos quedan en Firestore)
// Estos 3 valores NO son secretos: pueden estar en el código del navegador.
export const APPWRITE = {
  endpoint: "https://nyc.cloud.appwrite.io/v1",      // Copie el "API Endpoint" exacto de Settings del proyecto
  projectId: "6af338d5000938ee0839",
  bucketId: "6af33a8900024254001c"
};

export const MAX_MB = 5;
const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export const appwriteListo = () =>
  !APPWRITE.projectId.startsWith("PEGUE") && !APPWRITE.bucketId.startsWith("PEGUE");

export function validarArchivo(file) {
  if (!TIPOS.includes(file.type)) return `"${file.name}": solo se permiten PDF, JPG, PNG o WEBP.`;
  if (file.size > MAX_MB * 1024 * 1024) return `"${file.name}" supera el máximo de ${MAX_MB} MB.`;
  return null;
}

export const urlArchivo = fileId =>
  `${APPWRITE.endpoint}/storage/buckets/${APPWRITE.bucketId}/files/${encodeURIComponent(fileId)}/view?project=${APPWRITE.projectId}`;

export async function subirArchivo(file, subidoPor) {
  const fd = new FormData();
  fd.append("fileId", "unique()");
  fd.append("file", file, file.name);
  const r = await fetch(`${APPWRITE.endpoint}/storage/buckets/${APPWRITE.bucketId}/files`, {
    method: "POST",
    headers: { "X-Appwrite-Project": APPWRITE.projectId },
    body: fd
  });
  if (!r.ok) {
    let msg = "";
    try { msg = (await r.json()).message; } catch {}
    throw new Error(msg || `Appwrite respondió con error ${r.status}`);
  }
  const j = await r.json();
  return { nombre: file.name, fileId: j.$id, mime: file.type, tamano: file.size, subidoPor, fecha: new Date().toISOString() };
}