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
  const encoder = new TextEncoder();
  const data = encoder.encode(text.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
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
