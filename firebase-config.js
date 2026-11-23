// Configuración oficial y conexión a Firebase Firestore
// ASADA Bijagua de Upala — Sistema de Expedientes de Salud Ocupacional

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  addDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCtwcYvCMmCNpaqoQOqI3jFC40Iyi2rQd8",
  authDomain: "asadabijaguaclinica.firebaseapp.com",
  projectId: "asadabijaguaclinica",
  storageBucket: "asadabijaguaclinica.firebasestorage.app",
  messagingSenderId: "861937956688",
  appId: "1:861937956688:web:a50b31964f12aba3601e55",
  measurementId: "G-DGKR54X4JL"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Nombres de colecciones en Firestore
export const COL_TRABAJADORES = "trabajadores";
export const COL_BITACORA = "bitacora";

// Credenciales predeterminadas para Administración y Emergencia
// Admin: admin123 (hash SHA-256)
// Emergencia: 9119 (hash SHA-256)
export const HASH_ADMIN = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";
export const HASH_EMERG = "bedc725da6f59c82f22ba662298fa0c8892a4dceb7d47d9d703af3253818129f";

// Función utilitaria para generar hash SHA-256 en el navegador
export async function sha256(text) {
  const limpio = String(text ?? "").trim();
  if (globalThis.crypto?.subtle?.digest) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(limpio);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (_) {
      // Fallback below for insecure contexts / blocked subtle API
    }
  }
  // Fallback SHA-256 puro en JS (para contextos sin crypto.subtle, ej. file://)
  return sha256Fallback(limpio);
}

function sha256Fallback(str) {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const rotr = (n, x) => (x >>> n) | (x << (32 - n));
  const utf8 = unescape(encodeURIComponent(str));
  const bytes = [];
  for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 56; i >= 0; i -= 8) bytes.push((bitLen / Math.pow(2, i)) & 0xff);
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const w = new Array(64);
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (bytes[o+4*i]<<24)|(bytes[o+4*i+1]<<16)|(bytes[o+4*i+2]<<8)|bytes[o+4*i+3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7,w[i-15]) ^ rotr(18,w[i-15]) ^ (w[i-15]>>>3);
      const s1 = rotr(17,w[i-2]) ^ rotr(19,w[i-2]) ^ (w[i-2]>>>10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6,e) ^ rotr(11,e) ^ rotr(25,e);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(2,a) ^ rotr(13,a) ^ rotr(22,a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map(n => (n>>>0).toString(16).padStart(8,"0")).join("");
}

// Operaciones de base de datos Firestore
export async function obtenerTrabajador(cedula) {
  const cleanCedula = String(cedula).trim();
  const docRef = doc(db, COL_TRABAJADORES, cleanCedula);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

export async function guardarTrabajador(cedula, data, merge = true) {
  const cleanCedula = String(cedula).trim();
  const docRef = doc(db, COL_TRABAJADORES, cleanCedula);
  await setDoc(docRef, {
    ...data,
    actualizadoEn: new Date().toISOString()
  }, { merge });
  return true;
}

export async function obtenerTodosTrabajadores() {
  const colRef = collection(db, COL_TRABAJADORES);
  const snapshot = await getDocs(colRef);
  const trabajadores = [];
  snapshot.forEach(docSnap => {
    trabajadores.push({ id: docSnap.id, ...docSnap.data() });
  });
  return trabajadores.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}

export async function eliminarTrabajador(cedula) {
  const cleanCedula = String(cedula).trim();
  const docRef = doc(db, COL_TRABAJADORES, cleanCedula);
  await deleteDoc(docRef);
  return true;
}

export async function registrarBitacora(accion, detalle = "") {
  try {
    const colRef = collection(db, COL_BITACORA);
    await addDoc(colRef, {
      accion,
      detalle,
      fecha: new Date().toISOString(),
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn("Bitácora no pudo registrarse:", err);
  }
}
