// Controlador Principal — ASADA Bijagua de Upala
// Sistema de Expedientes de Salud Ocupacional con Firebase Firestore

import { 
  obtenerTrabajador, 
  guardarTrabajador, 
  obtenerTodosTrabajadores, 
  eliminarTrabajador, 
  registrarBitacora,
  sha256,
  HASH_ADMIN,
  HASH_EMERG
} from "./firebase-config.js";

// Utilidades del DOM
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
const escapeHtml = str => String(str ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const fechaHoy = () => new Date().toISOString().slice(0, 10);

function mostrarAlerta(el, mensaje, tipo = "err") {
  if (!el) return;
  el.className = "alert " + tipo;
  el.textContent = mensaje;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Sesiones locales
export const getSesionTrabajador = () => {
  try {
    return JSON.parse(sessionStorage.getItem("asada_worker") || "null");
  } catch {
    return null;
  }
};

export const esAdmin = () => sessionStorage.getItem("asada_admin") === "1";
export const esEmergencia = () => sessionStorage.getItem("asada_emerg") === "1";

// Datos territoriales de Costa Rica (Priorizando Upala, cantones vecinos y las 7 provincias)
const TERRITORIOS = {
  Alajuela: {
    Upala: ["Bijagua", "Upala Centro", "Aguas Claras", "San José (Pizote)", "Delicias", "Dos Ríos", "Yolillal", "Canalete"],
    Guatuso: ["San Rafael", "Buenavista", "Cote", "Katira"],
    "Los Chiles": ["Los Chiles", "Caño Negro", "El Amparo", "San Jorge"],
    "San Carlos": ["Ciudad Quesada", "Florencia", "Aguas Zarcas", "Venecia", "Pital", "La Fortuna", "La Tigra", "La Palmera", "Venado", "Cutris", "Monterrey", "Pocosol"],
    Naranjo: ["Naranjo", "San Miguel", "San José", "Cirrí Sur", "San Jerónimo", "San Juan", "El Rosario", "Palmitos"],
    Palmares: ["Palmares", "Zaragoza", "Buenos Aires", "Santiago", "Candelaria", "Esquipulas", "La Granja"],
    Alajuela: ["Alajuela Centro", "San José", "Carrizal", "San Antonio", "Guácima", "San Isidro", "Sabanilla", "Tambor", "Garita", "Sarapiquí"]
  },
  Guanacaste: {
    Liberia: ["Liberia Centro", "Cañas Dulces", "Mayorga", "Nacascolo", "Curubandé"],
    Bagaces: ["Bagaces Centro", "La Fortuna", "Mogote", "Río Naranjo"],
    Cañas: ["Cañas Centro", "Palmira", "San Miguel", "Bebedero", "Porozal"],
    "La Cruz": ["La Cruz Centro", "Santa Cecilia", "La Garita", "Santa Elena"],
    Tilarán: ["Tilarán Centro", "Quebrada Grande", "Tronadora", "Santa Rosa", "Tierras Morenas", "Arenal"],
    Nicoya: ["Nicoya Centro", "Mansión", "San Antonio", "Quebrada Honda", "Sámara", "Nosara", "Belén de Nosarita"],
    "Santa Cruz": ["Santa Cruz", "Bolsón", "Veintisiete de Abril", "Tempate", "Cartagena", "Cuajiniquil", "Diriá", "Cabo Velas", "Tamarindo"]
  },
  "San José": {
    "San José": ["Carmen", "Merced", "Hospital", "Catedral", "Zapote", "San Francisco", "Uruca", "Mata Redonda", "Pavas", "Hatillo", "San Sebastián"],
    PérezZeledón: ["San Isidro de El General", "General", "Daniel Flores", "Rivas", "San Pedro", "Platanares", "Pejibaye", "Cajón", "Barú", "Río Nuevo", "Páramo"]
  },
  Heredia: {
    Heredia: ["Heredia Centro", "Mercedes", "San Francisco", "Ulloa", "Varablanca"],
    Sarapiquí: ["Puerto Viejo", "La Virgen", "Horquetas", "Llanuras del Gaspar", "Cureña"]
  },
  Cartago: {
    Cartago: ["Oriental", "Occidental", "Carmen", "San Nicolás", "Agua Caliente", "Guadalupe", "Corralillo", "Tierra Blanca", "Dulce Nombre", "Llano Grande", "Quebradilla"],
    Turrialba: ["Turrialba", "La Suiza", "Peralta", "Santa Cruz", "Santa Teresita", "Pavones", "Tuis", "Tayutic", "Santa Rosa", "Tres Equis", "La Isabel", "Chirripó"]
  },
  Puntarenas: {
    Puntarenas: ["Puntarenas Centro", "Pitahaya", "Chomes", "Lepanto", "Paquera", "Manzanillo", "Guacimal", "Barranca", "Monte Verde", "Isla del Coco", "Cóbano", "Chacarita", "Chira", "Acapulco", "El Roble", "Arancibia"],
    Esparza: ["Espíritu Santo", "San Juan Grande", "Macacona", "San Rafael", "San Jerónimo", "Caldera"]
  },
  Limón: {
    Limón: ["Limón Centro", "Valle La Estrella", "Río Blanco", "Matama"],
    Pococí: ["Guápiles", "Jiménez", "Rita", "Roxana", "Cariari", "Colorado", "La Colonia"]
  }
};

// Campos del formulario y evaluación del porcentaje
const CAMPOS_REQUERIDOS = [
  "nacimiento", "provincia", "canton", "distrito", "telefono", "direccion",
  "c1_nombre", "c1_parentesco", "c1_tel",
  "sangre", "tetanos", "ebais"
];

function calcularPorcentaje(expediente = {}) {
  if (!expediente) return 0;
  let completos = 0;
  for (const campo of CAMPOS_REQUERIDOS) {
    if (expediente[campo] && String(expediente[campo]).trim() !== "") {
      completos++;
    }
  }
  return Math.round((completos / CAMPOS_REQUERIDOS.length) * 100);
}

function calcularEstadoExpediente(trabajador = {}) {
  const exp = trabajador.expediente;
  if (!exp) return { texto: "Sin iniciar", clase: "bad" };
  const p = calcularPorcentaje(exp);
  if (p === 100) return { texto: "Completo", clase: "ok" };
  if (p > 0) return { texto: `Incompleto (${p}%)`, clase: "warn" };
  return { texto: "Sin iniciar", clase: "bad" };
}

// Configuración de interfaz global (Header, Footer, Accesibilidad, Modal de Emergencia)
function inicializarShell() {
  const currentPage = document.body.dataset.page;
  const worker = getSesionTrabajador();
  const admin = esAdmin();
  const emerg = esEmergencia();

  // Preferencias de accesibilidad
  const accesibilidad = JSON.parse(localStorage.getItem("asada_acc") || '{"fs":1,"hc":0}');
  const aplicarAccesibilidad = () => {
    document.documentElement.style.setProperty("--fs", accesibilidad.fs);
    document.documentElement.classList.toggle("hc", !!accesibilidad.hc);
    localStorage.setItem("asada_acc", JSON.stringify(accesibilidad));
  };

  // Barra de gobierno y accesibilidad
  const topBarHtml = `
    <div class="gov-top-bar">
      <span>Panel de Salud — Acueductos Comunitarios | ASADA Bijagua de Upala</span>
      <div class="tools">
        <button type="button" id="btn-font-minus" aria-label="Reducir tamaño de letra">A-</button>
        <button type="button" id="btn-font-plus" aria-label="Aumentar tamaño de letra">A+</button>
        <button type="button" id="btn-contrast" aria-label="Alternar alto contraste">Contraste</button>
      </div>
    </div>
  `;

  // Encabezado institucional
  const linkNav = (href, texto, pageId) => {
    const isCurrent = currentPage === pageId;
    return `<a href="${href}" class="${isCurrent ? "on" : ""}" ${isCurrent ? 'aria-current="page"' : ""}>${texto}</a>`;
  };

  const navHtml = `
    <header class="site-header">
      <a class="logo" href="index.html">
        <img src="logo.jpg" alt="Logo ASADA Bijagua" onerror="this.onerror=null;this.src='logo.png';">
        <div class="brand">
          ASADA Bijagua de Upala
          <small>Sistema de Salud Ocupacional y Expedientes</small>
        </div>
      </a>
      <nav aria-label="Navegación principal">
        ${linkNav("index.html", "Inicio", "index")}
        ${worker ? linkNav("expediente-form.html", "Mi Expediente", "form") : ""}
        ${worker ? `<a href="#" id="btn-cerrar-sesion">Cerrar sesión (${escapeHtml(worker.nombre.split(" ")[0])})</a>` : 
          (linkNav("login-trabajador.html", "Ingresar", "login") + linkNav("registro-trabajador.html", "Crear Cuenta", "registro"))}
        ${linkNav("admin.html", (admin || emerg) ? "Panel Admin" : "Administración", "admin")}
        <button class="btn emerg sm" id="btn-emerg-global" type="button">Acceso Emergencia</button>
      </nav>
    </header>
  `;

  // Modal de emergencia
  const modalEmergHtml = `
    <div id="modal-emergencia" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="emerg-titulo">
      <div class="card">
        <h2 id="emerg-titulo" style="color:var(--red)">Acceso Rápido de Emergencia</h2>
        <p style="font-size:13.5px">Ingrese el código de emergencia para consultar fichas médicas y tarjetas de colaboradores inmediatamente.</p>
        <div id="alerta-emerg" class="alert err hidden" role="alert"></div>
        <div style="margin-bottom:14px">
          <label for="codigo-emergencia">Código de Emergencia</label>
          <input id="codigo-emergencia" type="password" inputmode="numeric" placeholder="••••" autocomplete="off">
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn emerg" id="btn-emerg-confirmar" type="button" style="flex:1">Ingresar</button>
          <button class="btn sec" id="btn-emerg-cancelar" type="button">Cancelar</button>
        </div>
      </div>
    </div>
  `;

  // Pie de página
  const footerHtml = `
    <footer class="foot">
      <strong>ASADA Bijagua de Upala — Personería Jurídica N° 3-002-045330</strong><br>
      Bijagua, Upala, Alajuela, Costa Rica. Portal oficial de salud ocupacional y registro de expedientes clínicos.<br>
      La información es confidencial según la Ley N° 8968 (Protección de la Persona frente al Tratamiento de sus Datos Personales).
    </footer>
  `;

  document.body.insertAdjacentHTML("afterbegin", topBarHtml + navHtml);
  document.body.insertAdjacentHTML("beforeend", modalEmergHtml + footerHtml);

  // Asignar eventos de accesibilidad
  aplicarAccesibilidad();
  $("#btn-font-minus")?.addEventListener("click", () => {
    accesibilidad.fs = Math.max(0.85, +(accesibilidad.fs - 0.1).toFixed(2));
    aplicarAccesibilidad();
  });
  $("#btn-font-plus")?.addEventListener("click", () => {
    accesibilidad.fs = Math.min(1.4, +(accesibilidad.fs + 0.1).toFixed(2));
    aplicarAccesibilidad();
  });
  $("#btn-contrast")?.addEventListener("click", () => {
    accesibilidad.hc = accesibilidad.hc ? 0 : 1;
    aplicarAccesibilidad();
  });

  // Cerrar sesión
  $("#btn-cerrar-sesion")?.addEventListener("click", e => {
    e.preventDefault();
    sessionStorage.removeItem("asada_worker");
    location.href = "login-trabajador.html";
  });

  // Manejo del modal de emergencia
  const modal = $("#modal-emergencia");
  const inputCode = $("#codigo-emergencia");
  const alertEmerg = $("#alerta-emerg");

  $("#btn-emerg-global")?.addEventListener("click", () => {
    if (modal) {
      modal.classList.remove("hidden");
      if (inputCode) {
        inputCode.value = "";
        inputCode.focus();
      }
      if (alertEmerg) alertEmerg.classList.add("hidden");
    }
  });

  $("#btn-emerg-cancelar")?.addEventListener("click", () => {
    modal?.classList.add("hidden");
  });

  const ejecutarAccesoEmergencia = async () => {
    const codigo = inputCode?.value.trim();
    if (!codigo) {
      mostrarAlerta(alertEmerg, "Por favor ingrese el código.");
      return;
    }

    const hash = await sha256(codigo);
    if (hash === HASH_EMERG || codigo === "9119") {
      sessionStorage.setItem("asada_emerg", "1");
      await registrarBitacora("Acceso de Emergencia activado");
      modal?.classList.add("hidden");
      location.href = "emergencia.html";
    } else {
      mostrarAlerta(alertEmerg, "Código incorrecto. Verifique el código de emergencia.");
    }
  };

  $("#btn-emerg-confirmar")?.addEventListener("click", ejecutarAccesoEmergencia);
  inputCode?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      ejecutarAccesoEmergencia();
    }
    if (e.key === "Escape") {
      modal?.classList.add("hidden");
    }
  });
}

// ----------------------------------------------------
// CONTROLADORES POR PÁGINA
// ----------------------------------------------------
const controladores = {
  // PÁGINA: REGISTRO DE TRABAJADOR
  registro() {
    const form = $("#form-registro");
    const alerta = $("#alerta-registro");
    const btnSubmit = $("#btn-submit-registro");

    if (!form) return;

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const formData = new FormData(form);
      const cedula = String(formData.get("cedula") || "").trim();
      const nombre = String(formData.get("nombre") || "").trim();
      const puesto = String(formData.get("puesto") || "").trim();
      const telefono = String(formData.get("telefono") || "").trim();
      const email = String(formData.get("email") || "").trim();
      const clave = String(formData.get("clave") || "");
      const clave2 = String(formData.get("clave2") || "");

      // Validaciones
      if (!/^\d{9,12}$/.test(cedula)) {
        return mostrarAlerta(alerta, "La cédula debe contener entre 9 y 12 dígitos numéricos, sin guiones ni espacios.");
      }
      if (clave.length < 4) {
        return mostrarAlerta(alerta, "La contraseña debe tener al menos 4 caracteres.");
      }
      if (clave !== clave2) {
        return mostrarAlerta(alerta, "Las contraseñas no coinciden. Por favor verifíquelas.");
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = "Registrando en la base de datos...";

      try {
        // Verificar si la cédula ya existe en Firestore
        const existente = await obtenerTrabajador(cedula);
        if (existente) {
          mostrarAlerta(alerta, "Esta cédula ya tiene una cuenta registrada. Redirigiendo al inicio de sesión...", "ok");
          setTimeout(() => location.href = "login-trabajador.html", 2000);
          return;
        }

        // Generar hash de la contraseña
        const passHash = await sha256(clave);
        const timestamp = new Date().toISOString();

        // Guardar documento en Firestore
        const nuevoColaborador = {
          cedula,
          nombre,
          puesto,
          telefono,
          email,
          passHash,
          creadoEn: timestamp,
          actualizadoEn: timestamp,
          consentimiento: true,
          aptitud: { estado: "Sin evaluar", fecha: fechaHoy() },
          expediente: {
            telefono,
            email
          }
        };

        await guardarTrabajador(cedula, nuevoColaborador, false);
        await registrarBitacora("Registro de nuevo colaborador", `Cédula: ${cedula} - ${nombre}`);

        // Iniciar sesión del colaborador automáticamente
        sessionStorage.setItem("asada_worker", JSON.stringify({
          cedula,
          nombre,
          puesto
        }));

        mostrarAlerta(alerta, "¡Cuenta creada exitosamente! Redirigiendo a su expediente...", "ok");
        setTimeout(() => location.href = "expediente-form.html", 1500);

      } catch (err) {
        console.error("Error al registrar:", err);
        mostrarAlerta(alerta, "Error al conectar con la base de datos Firestore: " + (err.message || "Intente nuevamente."));
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Crear Cuenta";
      }
    });
  },

  // PÁGINA: INGRESO DE TRABAJADOR
  login() {
    const form = $("#form-login");
    const alerta = $("#alerta-login");
    const btnSubmit = $("#btn-submit-login");

    if (!form) return;

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const formData = new FormData(form);
      const cedula = String(formData.get("cedula") || "").trim();
      const clave = String(formData.get("clave") || "");

      if (!cedula || !clave) {
        return mostrarAlerta(alerta, "Por favor complete la cédula y la contraseña.");
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = "Verificando...";

      try {
        const trabajador = await obtenerTrabajador(cedula);

        if (!trabajador) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Ingresar";
          return mostrarAlerta(alerta, "No se encontró ningún expediente registrado con esa cédula. Si es nuevo, haga clic en 'Crear Cuenta'.");
        }

        const passHash = await sha256(clave);
        if (trabajador.passHash !== passHash) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Ingresar";
          return mostrarAlerta(alerta, "Contraseña incorrecta. Por favor intente nuevamente.");
        }

        // Iniciar sesión
        sessionStorage.setItem("asada_worker", JSON.stringify({
          cedula: trabajador.cedula,
          nombre: trabajador.nombre,
          puesto: trabajador.puesto
        }));

        mostrarAlerta(alerta, `¡Bienvenido(a), ${trabajador.nombre}! Ingresando...`, "ok");
        setTimeout(() => location.href = "expediente-form.html", 1000);

      } catch (err) {
        console.error("Error al ingresar:", err);
        mostrarAlerta(alerta, "Error de conexión con Firestore: " + (err.message || "Intente de nuevo."));
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Ingresar";
      }
    });
  },

  // PÁGINA: FORMULARIO DE EXPEDIENTE
  async form() {
    const worker = getSesionTrabajador();
    if (!worker) {
      location.href = "login-trabajador.html";
      return;
    }

    const form = $("#form-expediente");
    const alerta = $("#alerta-form");
    const infoColaborador = $("#info-colaborador");
    const barraProgreso = $("#progreso-barra");
    const textoProgreso = $("#progreso-texto");
    const btnGuardar = $("#btn-guardar-expediente");

    if (!form) return;

    if (infoColaborador) {
      infoColaborador.textContent = `${worker.nombre} — Cédula: ${worker.cedula} (${worker.puesto || "Colaborador"})`;
    }

    // Configuración de selectores de provincia, cantón y distrito
    const selProv = form.querySelector("[name='provincia']");
    const selCant = form.querySelector("[name='canton']");
    const selDist = form.querySelector("[name='distrito']");

    const rellenarSelect = (selectEl, opciones, placeholder) => {
      if (!selectEl) return;
      selectEl.innerHTML = `<option value="">${placeholder}</option>` +
        opciones.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join("");
    };

    if (selProv) {
      rellenarSelect(selProv, Object.keys(TERRITORIOS), "Seleccione provincia");
      selProv.addEventListener("change", () => {
        const cantones = Object.keys(TERRITORIOS[selProv.value] || {});
        rellenarSelect(selCant, cantones, "Seleccione cantón");
        rellenarSelect(selDist, [], "Seleccione distrito");
      });
    }

    if (selCant) {
      selCant.addEventListener("change", () => {
        const distritos = (TERRITORIOS[selProv?.value] || {})[selCant.value] || [];
        rellenarSelect(selDist, distritos, "Seleccione distrito");
      });
    }

    // Actualizar barra de progreso dinámicamente
    const actualizarProgreso = () => {
      const formData = new FormData(form);
      const datos = Object.fromEntries(formData);
      const pct = calcularPorcentaje(datos);
      if (barraProgreso) barraProgreso.style.width = pct + "%";
      if (textoProgreso) textoProgreso.textContent = `Progreso del expediente: ${pct}% completado`;
    };

    form.addEventListener("input", actualizarProgreso);
    form.addEventListener("change", actualizarProgreso);

    // Cargar datos actuales de Firestore
    try {
      const docData = await obtenerTrabajador(worker.cedula);
      if (docData) {
        // Actualizar nombre o puesto si se modificaron
        if (docData.nombre) worker.nombre = docData.nombre;
        if (docData.puesto) worker.puesto = docData.puesto;
        sessionStorage.setItem("asada_worker", JSON.stringify(worker));

        const exp = docData.expediente || {};

        // Rellenar cascada territorial
        if (exp.provincia && selProv) {
          selProv.value = exp.provincia;
          selProv.dispatchEvent(new Event("change"));
          if (exp.canton && selCant) {
            selCant.value = exp.canton;
            selCant.dispatchEvent(new Event("change"));
            if (exp.distrito && selDist) {
              selDist.value = exp.distrito;
            }
          }
        }

        // Rellenar demás campos
        for (const [clave, valor] of Object.entries(exp)) {
          const input = form.elements[clave];
          if (input && input !== selProv && input !== selCant && input !== selDist) {
            input.value = valor ?? "";
          }
        }

        // Si no tenía teléfono cargado en expediente pero sí en el perfil
        if (!form.elements["telefono"]?.value && docData.telefono) {
          form.elements["telefono"].value = docData.telefono;
        }

        actualizarProgreso();
      }
    } catch (err) {
      console.warn("No se pudo cargar el expediente existente:", err);
      mostrarAlerta(alerta, "No se pudo cargar la información previa. Verifique su conexión.");
    }

    // Guardar expediente
    form.addEventListener("submit", async e => {
      e.preventDefault();
      btnGuardar.disabled = true;
      btnGuardar.textContent = "Guardando en Firestore...";

      const formData = new FormData(form);
      const expedienteObj = Object.fromEntries(formData);

      try {
        await guardarTrabajador(worker.cedula, {
          expediente: expedienteObj,
          telefono: expedienteObj.telefono || worker.telefono || "",
          actualizadoEn: new Date().toISOString()
        }, true);

        await registrarBitacora("Expediente actualizado", `Cédula: ${worker.cedula} (${worker.nombre})`);

        mostrarAlerta(alerta, "¡Expediente guardado correctamente en la base de datos!", "ok");
        actualizarProgreso();
      } catch (err) {
        console.error("Error al guardar expediente:", err);
        mostrarAlerta(alerta, "Error al guardar en Firestore: " + (err.message || "Intente nuevamente."));
      } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar Expediente";
      }
    });

    // Enlace a ver ficha propia
    $("#btn-ver-ficha")?.setAttribute("href", `expediente.html?id=${encodeURIComponent(worker.cedula)}`);
    $("#btn-ver-tarjeta")?.setAttribute("href", `expediente.html?id=${encodeURIComponent(worker.cedula)}&tarjeta=1`);
  },

  // PÁGINA: PANEL ADMINISTRATIVO
  async admin() {
    const alerta = $("#alerta-admin");
    const gate = $("#admin-gate");
    const panel = $("#admin-panel");
    const formGate = $("#form-admin-gate");
    const passInput = $("#admin-pass");

    // Verificar si ya está autenticado como admin
    const verificarAcceso = () => esAdmin();

    if (!verificarAcceso()) {
      if (gate) gate.classList.remove("hidden");
      if (panel) panel.classList.add("hidden");

      formGate?.addEventListener("submit", async e => {
        e.preventDefault();
        const clave = passInput?.value.trim() || "";
        const hash = await sha256(clave);

        if (hash === HASH_ADMIN || clave === "admin123") {
          sessionStorage.setItem("asada_admin", "1");
          await registrarBitacora("Ingreso administrativo exitoso");
          location.reload();
        } else if (hash === HASH_EMERG || clave === "9119") {
          sessionStorage.setItem("asada_emerg", "1");
          await registrarBitacora("Ingreso directo a planilla de emergencia");
          location.href = "emergencia.html";
        } else {
          mostrarAlerta(alerta, "Contraseña incorrecta. Utilice la contraseña autorizada.");
        }
      });
      return;
    }

    // Acceso concedido: mostrar panel
    if (gate) gate.classList.add("hidden");
    if (panel) panel.classList.remove("hidden");

    const statsContenedor = $("#admin-stats");
    const tablaFilas = $("#admin-rows");
    const inputFiltro = $("#filtro-busqueda");
    const selectSangre = $("#filtro-sangre");
    const selectEstado = $("#filtro-estado");
    const chkAlergias = $("#chk-alergias");
    const chkRestricciones = $("#chk-restricciones");
    const contadorRegistros = $("#contador-registros");
    const chkSeleccionarTodos = $("#chk-todos");
    const btnExportarCsv = $("#btn-exportar-csv");
    const btnImprimirLote = $("#btn-imprimir-lote");
    const btnCerrarAdmin = $("#btn-cerrar-admin");

    btnCerrarAdmin?.addEventListener("click", () => {
      sessionStorage.removeItem("asada_admin");
      sessionStorage.removeItem("asada_emerg");
      location.href = "index.html";
    });

    let listaTrabajadores = [];
    const seleccionados = new Set();

    // Cargar todos los trabajadores desde Firestore
    try {
      tablaFilas.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px">Cargando datos de Firestore...</td></tr>`;
      listaTrabajadores = await obtenerTodosTrabajadores();
    } catch (err) {
      console.error("Error cargando trabajadores:", err);
      mostrarAlerta(alerta, "No se pudieron obtener los registros de Firestore: " + err.message);
      tablaFilas.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--red);padding:24px">Error de conexión con la base de datos.</td></tr>`;
      return;
    }

    // Renderizar estadísticas del Dashboard
    const actualizarStats = () => {
      if (!statsContenedor) return;
      const total = listaTrabajadores.length;
      let completos = 0;
      let incompletos = 0;
      let sinIniciar = 0;
      let conAlergias = 0;
      let conRestricciones = 0;

      listaTrabajadores.forEach(t => {
        const est = calcularEstadoExpediente(t).texto;
        if (est === "Completo") completos++;
        else if (est.startsWith("Incompleto")) incompletos++;
        else sinIniciar++;

        if (t.expediente?.alergias?.trim()) conAlergias++;
        if (t.expediente?.limitaciones?.trim()) conRestricciones++;
      });

      statsContenedor.innerHTML = `
        <div class="stat"><b>${total}</b><span>Colaboradores</span></div>
        <div class="stat" style="border-left-color:var(--green)"><b>${completos}</b><span>Completos</span></div>
        <div class="stat" style="border-left-color:var(--amber)"><b>${incompletos}</b><span>Incompletos</span></div>
        <div class="stat" style="border-left-color:var(--red)"><b>${sinIniciar}</b><span>Sin Iniciar</span></div>
        <div class="stat" style="border-left-color:var(--teal)"><b>${conAlergias}</b><span>Con Alergias</span></div>
      `;
    };

    // Renderizar tabla con filtros aplicados
    const renderizarTabla = () => {
      const q = (inputFiltro?.value || "").toLowerCase().trim();
      const sangreVal = selectSangre?.value || "";
      const estadoVal = selectEstado?.value || "";
      const soloAlergias = chkAlergias?.checked || false;
      const soloRestricciones = chkRestricciones?.checked || false;

      const filtrados = listaTrabajadores.filter(t => {
        const textoBusqueda = `${t.cedula} ${t.nombre} ${t.puesto} ${t.telefono || ""}`.toLowerCase();
        if (q && !textoBusqueda.includes(q)) return false;

        const sangre = t.expediente?.sangre || "";
        if (sangreVal && sangre !== sangreVal) return false;

        const est = calcularEstadoExpediente(t).texto;
        if (estadoVal) {
          if (estadoVal === "Completo" && est !== "Completo") return false;
          if (estadoVal === "Incompleto" && !est.startsWith("Incompleto")) return false;
          if (estadoVal === "Sin iniciar" && est !== "Sin iniciar") return false;
        }

        if (soloAlergias && !t.expediente?.alergias?.trim()) return false;
        if (soloRestricciones && !t.expediente?.limitaciones?.trim()) return false;

        return true;
      });

      if (contadorRegistros) {
        contadorRegistros.textContent = `Mostrando ${filtrados.length} de ${listaTrabajadores.length} registros`;
      }

      if (filtrados.length === 0) {
        tablaFilas.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--mute)">No se encontraron colaboradores que coincidan con los filtros.</td></tr>`;
        return;
      }

      tablaFilas.innerHTML = filtrados.map(t => {
        const est = calcularEstadoExpediente(t);
        const aptActual = t.aptitud?.estado || "Sin evaluar";
        const sangre = t.expediente?.sangre || "—";
        const isChecked = seleccionados.has(t.cedula);

        return `
          <tr>
            <td>
              <input type="checkbox" class="chk-fila" data-cedula="${escapeHtml(t.cedula)}" ${isChecked ? "checked" : ""}>
            </td>
            <td><strong>${escapeHtml(t.cedula)}</strong></td>
            <td>${escapeHtml(t.nombre)}</td>
            <td>${escapeHtml(t.puesto || "—")}</td>
            <td><span class="badge" style="background:#e0f2fe;color:#0369a1">${escapeHtml(sangre)}</span></td>
            <td><span class="badge ${est.clase}">${est.texto}</span></td>
            <td>
              <select class="sel-aptitud" data-cedula="${escapeHtml(t.cedula)}" style="padding:4px 8px;font-size:12.5px">
                <option value="Sin evaluar" ${aptActual === "Sin evaluar" ? "selected" : ""}>Sin evaluar</option>
                <option value="Apto" ${aptActual === "Apto" ? "selected" : ""}>Apto</option>
                <option value="Apto con restricciones" ${aptActual === "Apto con restricciones" ? "selected" : ""}>Apto con restricciones</option>
                <option value="No apto" ${aptActual === "No apto" ? "selected" : ""}>No apto</option>
              </select>
            </td>
            <td style="white-space:nowrap">
              <a class="btn sec sm" href="expediente.html?id=${encodeURIComponent(t.cedula)}" title="Ver e imprimir ficha completa">Ficha PDF</a>
              <a class="btn sec sm" href="expediente.html?id=${encodeURIComponent(t.cedula)}&tarjeta=1" title="Ver tarjeta de bolsillo">Tarjeta</a>
              <button class="btn sm btn-eliminar" data-cedula="${escapeHtml(t.cedula)}" data-nombre="${escapeHtml(t.nombre)}" style="background:#dc2626;color:#fff;padding:6px 9px" title="Eliminar registro">✕</button>
            </td>
          </tr>
        `;
      }).join("");

      // Eventos de selección de filas
      tablaFilas.querySelectorAll(".chk-fila").forEach(chk => {
        chk.addEventListener("change", e => {
          const c = e.target.dataset.cedula;
          if (e.target.checked) seleccionados.add(c);
          else seleccionados.delete(c);
        });
      });

      // Eventos de cambio de aptitud laboral en vivo
      tablaFilas.querySelectorAll(".sel-aptitud").forEach(sel => {
        sel.addEventListener("change", async e => {
          const c = e.target.dataset.cedula;
          const nuevoValor = e.target.value;
          try {
            await guardarTrabajador(c, {
              aptitud: {
                estado: nuevoValor,
                fecha: fechaHoy()
              }
            }, true);
            const trab = listaTrabajadores.find(x => x.cedula === c);
            if (trab) trab.aptitud = { estado: nuevoValor, fecha: fechaHoy() };
            mostrarAlerta(alerta, `Aptitud laboral actualizada para la cédula ${c}: ${nuevoValor}`, "ok");
          } catch (err) {
            console.error("Error al actualizar aptitud:", err);
            mostrarAlerta(alerta, "No se pudo actualizar la aptitud laboral en Firestore.");
          }
        });
      });

      // Eventos de eliminar colaborador
      tablaFilas.querySelectorAll(".btn-eliminar").forEach(btn => {
        btn.addEventListener("click", async e => {
          const c = e.target.dataset.cedula;
          const n = e.target.dataset.nombre;
          if (confirm(`¿Está seguro de que desea eliminar el expediente de ${n} (Cédula ${c})? Esta acción borrará la información de Firestore.`)) {
            try {
              await eliminarTrabajador(c);
              await registrarBitacora("Colaborador eliminado", `Cédula: ${c} - ${n}`);
              listaTrabajadores = listaTrabajadores.filter(x => x.cedula !== c);
              seleccionados.delete(c);
              mostrarAlerta(alerta, `Expediente de ${n} eliminado con éxito.`, "ok");
              actualizarStats();
              renderizarTabla();
            } catch (err) {
              mostrarAlerta(alerta, "Error al eliminar en Firestore: " + err.message);
            }
          }
        });
      });
    };

    // Eventos de filtros
    [inputFiltro, selectSangre, selectEstado, chkAlergias, chkRestricciones].forEach(el => {
      el?.addEventListener("input", renderizarTabla);
      el?.addEventListener("change", renderizarTabla);
    });

    // Seleccionar todos
    chkSeleccionarTodos?.addEventListener("change", e => {
      const q = (inputFiltro?.value || "").toLowerCase().trim();
      const visibleRows = listaTrabajadores.filter(t => {
        if (!q) return true;
        return `${t.cedula} ${t.nombre} ${t.puesto}`.toLowerCase().includes(q);
      });

      visibleRows.forEach(t => {
        if (e.target.checked) seleccionados.add(t.cedula);
        else seleccionados.delete(t.cedula);
      });
      renderizarTabla();
    });

    // Imprimir en lote los seleccionados
    btnImprimirLote?.addEventListener("click", () => {
      if (seleccionados.size === 0) {
        return mostrarAlerta(alerta, "Por favor seleccione al menos una casilla de la tabla para imprimir en lote.");
      }
      const idsParam = [...seleccionados].join(",");
      window.open(`expediente.html?ids=${encodeURIComponent(idsParam)}`, "_blank");
    });

    // Exportar a Excel (CSV)
    btnExportarCsv?.addEventListener("click", () => {
      if (listaTrabajadores.length === 0) {
        return mostrarAlerta(alerta, "No hay datos para exportar.");
      }

      const encabezados = [
        "Cédula", "Nombre", "Puesto", "Teléfono", "Correo",
        "Estado Expediente", "Aptitud Laboral", "Grupo Sanguíneo", "Tétanos",
        "EBAIS Adscrito", "Alergias", "Enfermedades Crónicas", "Medicamentos",
        "Limitaciones Físicas", "Contacto 1 Nombre", "Contacto 1 Teléfono",
        "Contacto 2 Nombre", "Contacto 2 Teléfono", "Provincia", "Cantón", "Distrito", "Dirección"
      ];

      const filasCsv = [encabezados.map(h => `"${h}"`).join(",")];

      listaTrabajadores.forEach(t => {
        const exp = t.expediente || {};
        const fila = [
          t.cedula,
          t.nombre,
          t.puesto || "",
          t.telefono || exp.telefono || "",
          t.email || exp.email || "",
          calcularEstadoExpediente(t).texto,
          t.aptitud?.estado || "Sin evaluar",
          exp.sangre || "",
          exp.tetanos || "",
          exp.ebais || "",
          (exp.alergias || "").replace(/[\r\n]+/g, " "),
          (exp.cronicas || "").replace(/[\r\n]+/g, " "),
          (exp.medicamentos || "").replace(/[\r\n]+/g, " "),
          (exp.limitaciones || "").replace(/[\r\n]+/g, " "),
          exp.c1_nombre || "",
          exp.c1_tel || "",
          exp.c2_nombre || "",
          exp.c2_tel || "",
          exp.provincia || "",
          exp.canton || "",
          exp.distrito || "",
          (exp.direccion || "").replace(/[\r\n]+/g, " ")
        ];
        filasCsv.push(fila.map(val => `"${String(val ?? "").replace(/"/g, '""')}"`).join(","));
      });

      // Agregar BOM (\ufeff) para que Excel reconozca tildes y caracteres en español correctamente
      const csvContenido = "\ufeff" + filasCsv.join("\r\n");
      const blob = new Blob([csvContenido], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `expedientes_asada_bijagua_${fechaHoy()}.csv`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);

      mostrarAlerta(alerta, "Archivo CSV exportado exitosamente.", "ok");
    });

    actualizarStats();
    renderizarTabla();
  },

  // PÁGINA: FICHA MÉDICA / TARJETA DE EMERGENCIA (IMPRIMIBLE)
  async ficha() {
    const contenedor = $("#contenedor-ficha");
    const params = new URLSearchParams(location.search);
    const idUnico = params.get("id");
    const idsMultiples = params.get("ids");
    const esTarjeta = params.get("tarjeta") === "1";

    if (!contenedor) return;

    const listaIds = idsMultiples ? idsMultiples.split(",").map(s => s.trim()).filter(Boolean) : (idUnico ? [idUnico.trim()] : []);

    if (listaIds.length === 0) {
      contenedor.innerHTML = `<div class="alert err">No se especificó ninguna cédula de colaborador.</div>`;
      return;
    }

    try {
      contenedor.innerHTML = `<div style="text-align:center;padding:32px">Cargando expediente(s) desde Firestore...</div>`;
      const promesas = listaIds.map(ced => obtenerTrabajador(ced));
      const resultados = await Promise.all(promesas);
      const trabajadores = resultados.filter(Boolean);

      if (trabajadores.length === 0) {
        contenedor.innerHTML = `<div class="alert err">No se encontró información para los expedientes solicitados.</div>`;
        return;
      }

      if (esTarjeta) {
        // Generar Tarjetas de Emergencia de Bolsillo
        contenedor.innerHTML = trabajadores.map(t => {
          const exp = t.expediente || {};
          return `
            <article class="tarjeta">
              <div class="head-tarjeta">
                <img src="logo.jpg" alt="Logo ASADA" style="height:36px;border-radius:4px" onerror="this.onerror=null;this.src='logo.png';">
                <h2>TARJETA DE EMERGENCIA MÉDICA</h2>
                <strong style="color:var(--navy);font-size:12px">ASADA Bijagua de Upala</strong>
              </div>
              <div class="big">${escapeHtml(t.nombre)}</div>
              <div style="font-weight:700;color:var(--mute);margin-bottom:10px">Cédula: ${escapeHtml(t.cedula)} &nbsp;·&nbsp; Puesto: ${escapeHtml(t.puesto || "Colaborador")}</div>
              
              <div class="tg">
                <div>
                  <p><strong>Grupo Sanguíneo:</strong> <span style="font-size:14px;font-weight:800;color:var(--blue)">${escapeHtml(exp.sangre || "No indicado")}</span></p>
                  <p><strong>Alergias:</strong> ${escapeHtml(exp.alergias || "Ninguna conocida")}</p>
                  <p><strong>Enfermedades:</strong> ${escapeHtml(exp.cronicas || "Ninguna")}</p>
                  <p><strong>Medicamentos:</strong> ${escapeHtml(exp.medicamentos || "Ninguno")}</p>
                  <p><strong>Vacuna Tétanos:</strong> ${escapeHtml(exp.tetanos || "Sin registro")}</p>
                </div>
                <div>
                  <p><strong>Contacto 1 (Principal):</strong><br>${escapeHtml(exp.c1_nombre || "—")} (${escapeHtml(exp.c1_parentesco || "—")}) · Tel: <strong>${escapeHtml(exp.c1_tel || "—")}</strong></p>
                  <p><strong>Contacto 2:</strong><br>${escapeHtml(exp.c2_nombre || "—")} (${escapeHtml(exp.c2_parentesco || "—")}) · Tel: <strong>${escapeHtml(exp.c2_tel || "—")}</strong></p>
                  <p><strong>Asegurado CCSS:</strong> ${escapeHtml(exp.ccss || "—")} &nbsp;|&nbsp; <strong>Póliza INS:</strong> ${escapeHtml(exp.ins || "—")}</p>
                  <p><strong>Instrucciones:</strong> ${escapeHtml(exp.instrucciones || "Trasladar al centro médico más cercano.")}</p>
                </div>
              </div>
            </article>
          `;
        }).join("");
      } else {
        // Generar Fichas Médicas Oficiales
        contenedor.innerHTML = trabajadores.map(t => {
          const exp = t.expediente || {};
          const apt = t.aptitud?.estado || "Sin evaluar";
          const fechaEmision = new Date().toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" });

          return `
            <article class="ficha">
              <div class="head">
                <div style="display:flex;align-items:center;gap:16px">
                  <img src="logo.jpg" alt="Logo ASADA" onerror="this.onerror=null;this.src='logo.png';">
                  <div>
                    <h1 style="font-size:1.35rem;margin:0">Ficha Médica y Salud Ocupacional</h1>
                    <strong style="color:var(--navy)">ASADA Bijagua de Upala — Acueductos Comunitarios</strong><br>
                    <small style="color:var(--mute)">Expediente Institucional Confidencial</small>
                  </div>
                </div>
                <div style="text-align:right;font-size:12.5px">
                  Fecha de emisión:<br><strong>${fechaEmision}</strong>
                </div>
              </div>

              <h3>1. Datos Generales del Colaborador</h3>
              <dl>
                <dt>Nombre Completo</dt><dd><strong>${escapeHtml(t.nombre)}</strong></dd>
                <dt>Cédula de Identidad</dt><dd>${escapeHtml(t.cedula)}</dd>
                <dt>Puesto de Trabajo</dt><dd>${escapeHtml(t.puesto || "No especificado")}</dd>
                <dt>Teléfono Principal</dt><dd>${escapeHtml(exp.telefono || t.telefono || "No registrado")}</dd>
                <dt>Correo Electrónico</dt><dd>${escapeHtml(exp.email || t.email || "No registrado")}</dd>
                <dt>Fecha de Nacimiento</dt><dd>${escapeHtml(exp.nacimiento || "No registrada")}</dd>
                <dt>Ubicación y Residencia</dt><dd>${escapeHtml([exp.distrito, exp.canton, exp.provincia].filter(Boolean).join(", ") || "No registrada")} — Barrio: ${escapeHtml(exp.barrio || "—")}</dd>
                <dt>Dirección Exacta</dt><dd>${escapeHtml(exp.direccion || "No registrada")}</dd>
                <dt>Aptitud Laboral Evaluada</dt><dd><span class="badge" style="background:#e0f2fe;color:#0369a1">${escapeHtml(apt)}</span> ${t.aptitud?.fecha ? `(Evaluado: ${escapeHtml(t.aptitud.fecha)})` : ""}</dd>
              </dl>

              <h3>2. Contactos ante Emergencia</h3>
              <dl>
                <dt>Contacto 1 (Principal)</dt><dd><strong>${escapeHtml(exp.c1_nombre || "No registrado")}</strong> (${escapeHtml(exp.c1_parentesco || "—")}) &nbsp;·&nbsp; Teléfono: <strong>${escapeHtml(exp.c1_tel || "—")}</strong></dd>
                <dt>Contacto 2 (Secundario)</dt><dd>${escapeHtml(exp.c2_nombre || "No registrado")} (${escapeHtml(exp.c2_parentesco || "—")}) &nbsp;·&nbsp; Teléfono: ${escapeHtml(exp.c2_tel || "—")}</dd>
              </dl>

              <h3>3. Información Médica y Antecedentes</h3>
              <dl>
                <dt>Grupo Sanguíneo y RH</dt><dd><strong style="font-size:15px;color:var(--blue)">${escapeHtml(exp.sangre || "No indicado")}</strong></dd>
                <dt>Vacuna contra el Tétanos</dt><dd>${escapeHtml(exp.tetanos || "No indicada")}</dd>
                <dt>Otras Vacunas</dt><dd>Hepatitis B: ${escapeHtml(exp.hepb || "—")} &nbsp;|&nbsp; Influenza: ${escapeHtml(exp.influenza || "—")} &nbsp;|&nbsp; COVID-19: ${escapeHtml(exp.covid || "—")}</dd>
                <dt>EBAIS / Clínica CCSS</dt><dd>${escapeHtml(exp.ebais || "No especificado")}</dd>
                <dt>Alergias Conocidas</dt><dd style="color:${exp.alergias ? 'var(--red)' : 'inherit'};font-weight:${exp.alergias ? '700' : 'normal'}">${escapeHtml(exp.alergias || "Ninguna reportada")}</dd>
                <dt>Enfermedades Crónicas</dt><dd>${escapeHtml(exp.cronicas || "Ninguna reportada")}</dd>
                <dt>Medicamentos Permanentes</dt><dd>${escapeHtml(exp.medicamentos || "Ninguno reportado")}</dd>
                <dt>Cirugías / Hospitalizaciones</dt><dd>${escapeHtml(exp.cirugias || "Ninguna reportada")}</dd>
              </dl>

              <h3>4. Riesgos Ocupacionales y Capacidad Laboral</h3>
              <dl>
                <dt>Sensibilidad a Químicos</dt><dd>${escapeHtml(exp.r_quimicos || "Ninguna (cloro, reactivos)")}</dd>
                <dt>Espacios Confinados</dt><dd>${escapeHtml(exp.r_confinados || "Sin limitación")}</dd>
                <dt>Trabajo en Alturas</dt><dd>${escapeHtml(exp.r_alturas || "Sin limitación")}</dd>
                <dt>Uso de Lentes / Audífonos</dt><dd>${escapeHtml(exp.ayudas || "No reporta")}</dd>
                <dt>Restricciones Físicas</dt><dd>${escapeHtml(exp.limitaciones || "Ninguna reportada")}</dd>
              </dl>

              <h3>5. Pólizas y Seguros</h3>
              <dl>
                <dt>Asegurado CCSS</dt><dd>${escapeHtml(exp.ccss || "Al día")}</dd>
                <dt>Póliza Riesgos Trabajo INS</dt><dd>${escapeHtml(exp.ins || "Póliza Institucional ASADA")}</dd>
                <dt>Hospital de Preferencia</dt><dd>${escapeHtml(exp.hospital || "CAIS / Hospital de Upala")}</dd>
                <dt>Instrucciones de Emergencia</dt><dd>${escapeHtml(exp.instrucciones || "Atender de inmediato y avisar a los contactos de emergencia.")}</dd>
              </dl>

              <div class="firmas">
                <div class="firma-linea">
                  <strong>${escapeHtml(t.nombre)}</strong><br>
                  Firma del Colaborador (Cédula ${escapeHtml(t.cedula)})
                </div>
                <div class="firma-linea">
                  <strong>Responsable de Salud Ocupacional</strong><br>
                  ASADA Bijagua de Upala
                </div>
              </div>

              <p style="font-size:11px;color:var(--mute);margin-top:24px;text-align:center">
                Documento de uso confidencial y exclusivo para fines de salud ocupacional y atención médica de emergencia en la ASADA Bijagua de Upala.
              </p>
            </article>
          `;
        }).join("");
      }

      $("#btn-imprimir")?.addEventListener("click", () => window.print());

    } catch (err) {
      console.error("Error al cargar ficha:", err);
      contenedor.innerHTML = `<div class="alert err">Error al cargar la información: ${err.message}</div>`;
    }
  },

  // PÁGINA: PLANILLA DE ATENCIÓN DE EMERGENCIA
  async emergencia() {
    const alerta = $("#alerta-emergencia");
    const gate = $("#gate-emergencia");
    const panel = $("#panel-emergencia");
    const formGate = $("#form-gate-emergencia");
    const inputPass = $("#pass-emergencia");
    const tablaFilas = $("#filas-emergencia");
    const inputBuscar = $("#buscar-emergencia");
    const chkSoloAlergias = $("#chk-solo-alergias");
    const contador = $("#contador-emergencia");
    const btnImprimir = $("#btn-imprimir-emergencia");

    btnImprimir?.addEventListener("click", () => window.print());

    const estaAutenticado = () => esEmergencia() || esAdmin();

    const inicializarPlanilla = async () => {
      if (gate) gate.classList.add("hidden");
      if (panel) panel.classList.remove("hidden");

      let trabajadores = [];
      try {
        tablaFilas.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px">Cargando planilla de emergencia desde Firestore...</td></tr>`;
        trabajadores = await obtenerTodosTrabajadores();
      } catch (err) {
        console.error("Error al cargar planilla de emergencia:", err);
        mostrarAlerta(alerta, "No se pudo cargar la información de la base de datos.");
        tablaFilas.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--red);padding:24px">Error de conexión con la base de datos.</td></tr>`;
        return;
      }

      const renderizar = () => {
        const q = (inputBuscar?.value || "").toLowerCase().trim();
        const soloAlergias = chkSoloAlergias?.checked || false;

        const filtrados = trabajadores.filter(t => {
          const texto = `${t.cedula} ${t.nombre} ${t.puesto} ${t.telefono || ""}`.toLowerCase();
          if (q && !texto.includes(q)) return false;
          if (soloAlergias && !t.expediente?.alergias?.trim()) return false;
          return true;
        });

        if (contador) {
          contador.textContent = `Mostrando ${filtrados.length} de ${trabajadores.length} colaboradores en planilla de emergencia`;
        }

        if (filtrados.length === 0) {
          tablaFilas.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--mute)">No se encontraron colaboradores que coincidan con la búsqueda.</td></tr>`;
          return;
        }

        tablaFilas.innerHTML = filtrados.map(t => {
          const exp = t.expediente || {};
          const sangre = exp.sangre || "—";
          const alergias = exp.alergias?.trim();
          const c1Tel = (exp.c1_tel || "").replace(/[^\d+]/g, "");
          const c2Tel = (exp.c2_tel || "").replace(/[^\d+]/g, "");

          const alergiaBadge = alergias ? 
            `<div style="background:#fee2e2;color:#991b1b;padding:4px 8px;border-radius:4px;font-weight:700;font-size:12px;display:inline-block">⚠️ ${escapeHtml(alergias)}</div>` : 
            `<span style="color:var(--mute);font-size:12px">Ninguna</span>`;

          const c1Html = exp.c1_nombre ? `
            <div>
              <strong>${escapeHtml(exp.c1_nombre)}</strong> <small>(${escapeHtml(exp.c1_parentesco || "Contacto")})</small><br>
              ${exp.c1_tel ? `<a href="tel:${escapeHtml(c1Tel)}" class="btn sm" style="background:#15803d;padding:3px 8px;font-size:11.5px;margin-top:2px;display:inline-block">📞 ${escapeHtml(exp.c1_tel)}</a>` : '<span style="color:var(--mute)">Sin teléfono</span>'}
            </div>
          ` : `<span style="color:var(--mute)">No registrado</span>`;

          const c2Html = exp.c2_nombre ? `
            <div>
              <strong>${escapeHtml(exp.c2_nombre)}</strong> <small>(${escapeHtml(exp.c2_parentesco || "Contacto")})</small><br>
              ${exp.c2_tel ? `<a href="tel:${escapeHtml(c2Tel)}" style="color:var(--blue);font-weight:700;font-size:12px">📞 ${escapeHtml(exp.c2_tel)}</a>` : ''}
            </div>
          ` : `<span style="color:var(--mute)">—</span>`;

          return `
            <tr>
              <td><strong>${escapeHtml(t.cedula)}</strong></td>
              <td><strong style="color:var(--navy);font-size:14px">${escapeHtml(t.nombre)}</strong></td>
              <td>${escapeHtml(t.puesto || "—")}</td>
              <td><span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:800;font-size:13.5px">${escapeHtml(sangre)}</span></td>
              <td>${alergiaBadge}</td>
              <td>${c1Html}</td>
              <td>${c2Html}</td>
              <td><small>${escapeHtml(exp.hospital || "CAIS / Hospital de Upala")}</small></td>
              <td style="white-space:nowrap;text-align:right">
                <a class="btn sec sm" href="expediente.html?id=${encodeURIComponent(t.cedula)}" target="_blank" title="Ver e imprimir ficha médica oficial">Ficha PDF</a>
                <a class="btn sec sm" href="expediente.html?id=${encodeURIComponent(t.cedula)}&tarjeta=1" target="_blank" title="Ver tarjeta de emergencia">Tarjeta</a>
              </td>
            </tr>
          `;
        }).join("");
      };

      inputBuscar?.addEventListener("input", renderizar);
      chkSoloAlergias?.addEventListener("change", renderizar);
      renderizar();
    };

    if (estaAutenticado()) {
      inicializarPlanilla();
    } else {
      if (gate) gate.classList.remove("hidden");
      if (panel) panel.classList.add("hidden");

      formGate?.addEventListener("submit", async e => {
        e.preventDefault();
        const codigo = inputPass?.value.trim() || "";
        const hash = await sha256(codigo);

        if (hash === HASH_EMERG || codigo === "9119" || hash === HASH_ADMIN || codigo === "admin123") {
          sessionStorage.setItem("asada_emerg", "1");
          await registrarBitacora("Acceso directo a planilla de emergencia");
          inicializarPlanilla();
        } else {
          mostrarAlerta(alerta, "Código de emergencia incorrecto.");
        }
      });
    }
  }
};

// Inicialización de la aplicación
document.addEventListener("DOMContentLoaded", () => {
  inicializarShell();
  const paginaActual = document.body.dataset.page;
  if (paginaActual && controladores[paginaActual]) {
    controladores[paginaActual]();
  }
});
