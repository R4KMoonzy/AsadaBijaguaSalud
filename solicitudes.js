// Solicitudes de citas, justificaciones e incapacidades — ASADA Bijagua de Upala
import { db, registrarBitacora, obtenerTodosTrabajadores } from "./firebase-config.js";
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { subirArchivo, validarArchivo, urlArchivo, appwriteListo, ACCEPT } from "./appwrite-config.js";

const COL = "solicitudes";
const $ = (s, c = document) => c.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtF = iso => iso ? iso.split("-").reverse().join("/") : "—";
const fmtDT = iso => iso ? new Date(iso).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" }) : "—";
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
const CLASE = { Pendiente: "warn", Autorizada: "ok", "No autorizada": "bad", Cancelada: "mute" };
const badge = e => `<span class="badge ${CLASE[e] || "warn"}">${esc(e)}</span>`;
const masNuevas = (a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "");

function alerta(el, msg, tipo = "err") {
  el.className = "alert " + tipo;
  el.textContent = msg;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

const adjuntosHtml = (lista = [], etiqueta) => lista.length
  ? `<div class="adjs"><small>${etiqueta}</small>${lista.map(a =>
      `<a class="adj" href="${esc(urlArchivo(a.fileId))}" target="_blank" rel="noopener">📎 ${esc(a.nombre)} <small>(${kb(a.tamano || 0)})</small></a>`).join("")}</div>`
  : "";

const detalleFechas = s => s.tipo === "Incapacidad"
  ? `Del ${fmtF(s.fechaInicio)} al ${fmtF(s.fechaFin)}`
  : `${fmtF(s.fechaInicio)}${s.hora ? " a las " + esc(s.hora) : ""}`;

const cuerpo = s => `
  <div class="sol-head">
    <div><strong>${esc(s.tipo)}</strong><br><small>${detalleFechas(s)}</small></div>
    ${badge(s.estado)}
  </div>
  <p class="sol-motivo">${esc(s.motivo)}</p>
  ${adjuntosHtml(s.adjuntos, "Documentos del colaborador")}
  ${s.respuesta ? `<div class="sol-resp"><strong>Respuesta de Administración</strong> <small>(${fmtDT(s.respuesta.fecha)})</small><p>${esc(s.respuesta.comentario || "Sin comentario.")}</p></div>` : ""}
  ${adjuntosHtml(s.adjuntosAdmin, "Documentos de Administración")}
  <small class="sol-meta">Enviada el ${fmtDT(s.creadoEn)}</small>`;

async function subirVarios(files, subidoPor, onProgreso) {
  const out = [];
  let i = 0;
  for (const f of files) {
    onProgreso?.(++i, files.length);
    out.push(await subirArchivo(f, subidoPor));
  }
  return out;
}

function errorArchivos(files) {
  for (const f of files) { const e = validarArchivo(f); if (e) return e; }
  if (files.length && !appwriteListo()) return "El almacenamiento de documentos aún no está configurado (appwrite-config.js).";
  return null;
}

// ---------------------------------------------------------------
// COLABORADOR
// ---------------------------------------------------------------
function paginaTrabajador() {
  const w = JSON.parse(sessionStorage.getItem("asada_worker") || "null");
  if (!w) { location.href = "login-trabajador.html"; return; }

  const form = $("#form-sol"), al = $("#alerta-sol"), btn = $("#btn-enviar-sol");
  const lblF = $("#lbl-fecha"), boxFin = $("#box-fin"), boxHora = $("#box-hora"), hint = $("#hint-adj");
  $("#info-sol").textContent = `${w.nombre} — Cédula: ${w.cedula}`;
  form.elements.archivos.accept = ACCEPT;

  const ajustar = () => {
    const t = form.elements.tipo.value;
    lblF.textContent = t === "Incapacidad" ? "Inicio de la incapacidad *"
      : t === "Justificación de cita" ? "Fecha de la cita a justificar *" : "Fecha solicitada para la cita *";
    boxFin.classList.toggle("hidden", t !== "Incapacidad");
    form.elements.fechaFin.required = t === "Incapacidad";
    boxHora.classList.toggle("hidden", t !== "Cita médica");
    hint.textContent = t === "Cita médica" ? "Opcional: orden médica o referencia."
      : t === "Incapacidad" ? "Obligatorio: boleta de incapacidad (CCSS, INS u otra)."
      : "Obligatorio: comprobante de la cita (constancia, comprobante de asistencia).";
  };
  form.elements.tipo.addEventListener("change", ajustar);
  ajustar();

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const t = fd.get("tipo"), inicio = fd.get("fechaInicio"), fin = fd.get("fechaFin");
    const files = [...form.elements.archivos.files];

    if (t === "Incapacidad" && fin < inicio) return alerta(al, "La fecha final no puede ser anterior a la inicial.");
    if (t !== "Cita médica" && !files.length) return alerta(al, "Debe adjuntar al menos un documento para este tipo de solicitud.");
    const err = errorArchivos(files);
    if (err) return alerta(al, err);

    btn.disabled = true;
    try {
      const adjuntos = await subirVarios(files, "colaborador", (i, n) => btn.textContent = `Subiendo documento ${i} de ${n}...`);
      btn.textContent = "Guardando solicitud...";
      const now = new Date().toISOString();
      await addDoc(collection(db, COL), {
        cedula: w.cedula, nombre: w.nombre, puesto: w.puesto || "",
        tipo: t, fechaInicio: inicio, fechaFin: t === "Incapacidad" ? fin : "",
        hora: t === "Cita médica" ? (fd.get("hora") || "") : "",
        motivo: String(fd.get("motivo") || "").trim(),
        adjuntos, adjuntosAdmin: [], estado: "Pendiente", respuesta: null,
        creadoEn: now, actualizadoEn: now
      });
      await registrarBitacora("Solicitud creada", `${t} — ${w.cedula} (${w.nombre})`);
      form.reset(); ajustar();
      alerta(al, "¡Solicitud enviada! Puede seguir su estado en el historial.", "ok");
    } catch (er) {
      console.error(er);
      alerta(al, "No se pudo enviar la solicitud: " + (er.message || "intente de nuevo."));
    } finally {
      btn.disabled = false; btn.textContent = "Enviar Solicitud";
    }
  });

  // Historial en tiempo real
  let lista = [];
  const cont = $("#lista-sol"), filtro = $("#filtro-estado-sol"), stats = $("#stats-sol");
  const render = () => {
    const c = n => lista.filter(s => s.estado === n).length;
    stats.innerHTML = `
      <div class="stat"><b>${lista.length}</b><span>Total</span></div>
      <div class="stat" style="border-left-color:var(--amber)"><b>${c("Pendiente")}</b><span>Pendientes</span></div>
      <div class="stat" style="border-left-color:var(--green)"><b>${c("Autorizada")}</b><span>Autorizadas</span></div>
      <div class="stat" style="border-left-color:var(--red)"><b>${c("No autorizada")}</b><span>No autorizadas</span></div>`;
    const v = lista.filter(s => !filtro.value || s.estado === filtro.value);
    cont.innerHTML = v.length ? v.map(s => `
      <article class="sol-card" data-id="${esc(s.id)}">${cuerpo(s)}
        ${s.estado === "Pendiente" ? `<div class="sol-acc"><button class="btn sec sm" data-act="cancelar" type="button">Cancelar solicitud</button></div>` : ""}
      </article>`).join("") : `<p class="vacio">No hay solicitudes para mostrar.</p>`;
  };
  filtro.addEventListener("change", render);

  onSnapshot(query(collection(db, COL), where("cedula", "==", w.cedula)),
    snap => { lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(masNuevas); render(); },
    err => { console.error(err); alerta(al, "No se pudo cargar su historial: " + err.message); });

  cont.addEventListener("click", async e => {
    const b = e.target.closest("[data-act='cancelar']");
    if (!b || !confirm("¿Desea cancelar esta solicitud?")) return;
    try {
      await updateDoc(doc(db, COL, b.closest(".sol-card").dataset.id), { estado: "Cancelada", actualizadoEn: new Date().toISOString() });
      await registrarBitacora("Solicitud cancelada", `${w.cedula} (${w.nombre})`);
    } catch (er) { alerta(al, "No se pudo cancelar: " + er.message); }
  });
}

// ---------------------------------------------------------------
// ADMINISTRACIÓN
// ---------------------------------------------------------------
async function paginaAdmin() {
  if (sessionStorage.getItem("asada_admin") !== "1") { location.href = "admin.html"; return; }

  const al = $("#alerta-sol-admin"), listaEl = $("#lista-colab"), panel = $("#panel-sol"), buscar = $("#buscar-colab");
  let trabajadores = [], sols = [], sel = "", filtroEstado = "Pendiente";

  const cuenta = (ced, est) => sols.filter(s => s.cedula === ced && (!est || s.estado === est)).length;

  const renderColabs = () => {
    const q = buscar.value.toLowerCase().trim();
    const items = trabajadores
      .filter(t => `${t.cedula} ${t.nombre} ${t.puesto || ""}`.toLowerCase().includes(q))
      .map(t => ({ t, p: cuenta(t.cedula, "Pendiente") }))
      .sort((a, b) => b.p - a.p || (a.t.nombre || "").localeCompare(b.t.nombre || ""));
    const totalP = sols.filter(s => s.estado === "Pendiente").length;
    const pill = n => n ? `<span class="pill">${n}</span>` : "";
    listaEl.innerHTML =
      `<button type="button" class="colab ${sel === "" ? "on" : ""}" data-ced=""><span><strong>Todos los colaboradores</strong><small>${sols.length} solicitudes</small></span>${pill(totalP)}</button>` +
      items.map(({ t, p }) => `
        <button type="button" class="colab ${sel === t.cedula ? "on" : ""}" data-ced="${esc(t.cedula)}">
          <span><strong>${esc(t.nombre)}</strong><small>${esc(t.cedula)} · ${esc(t.puesto || "—")}</small></span>${pill(p)}
        </button>`).join("");
  };

  const cardAdmin = s => {
    const pend = s.estado === "Pendiente";
    return `<article class="sol-card" data-id="${esc(s.id)}">
      ${!sel ? `<small class="sol-quien"><strong>${esc(s.nombre)}</strong> · ${esc(s.cedula)} · ${esc(s.puesto || "")}</small>` : ""}
      ${cuerpo(s)}
      ${s.estado === "Cancelada" ? "" : `<div class="sol-gest">
        ${pend ? `<label>Comentario para el colaborador (obligatorio si no se autoriza)</label><textarea class="com" placeholder="Indique observaciones o motivo de la decisión..."></textarea>` : ""}
        <label style="margin-top:8px">${pend ? "Adjuntar documentos (opcional)" : "Adjuntar otro documento"}</label>
        <input type="file" class="fil" multiple accept="${ACCEPT}">
        <div class="sol-btns">
          ${pend
            ? `<button class="btn" data-act="Autorizada" type="button" style="background:var(--green)">✔ Autorizar</button>
               <button class="btn emerg" data-act="No autorizada" type="button">✖ No autorizar</button>`
            : `<button class="btn sec sm" data-act="subir" type="button">Subir documento</button>
               <button class="btn sec sm" data-act="reabrir" type="button">Reabrir solicitud</button>`}
        </div></div>`}
    </article>`;
  };

  const renderPanel = () => {
    const t = trabajadores.find(x => x.cedula === sel);
    const todas = sols.filter(s => !sel || s.cedula === sel).sort(masNuevas);
    const vis = todas.filter(s => !filtroEstado || s.estado === filtroEstado);
    const opt = v => `<option value="${v}" ${filtroEstado === v ? "selected" : ""}>${v || "Todos"}</option>`;
    panel.innerHTML = `
      <div class="sol-top">
        <div><h2 style="margin:0">${sel ? esc(t?.nombre || sel) : "Todas las solicitudes"}</h2>
          ${sel ? `<small style="color:var(--mute)">Cédula ${esc(sel)} · ${esc(t?.puesto || "—")} · ${todas.length} solicitud(es) en total</small>` : ""}</div>
        <div><label for="filtro-est-adm">Estado</label>
          <select id="filtro-est-adm">${["Pendiente", "Autorizada", "No autorizada", "Cancelada", ""].map(opt).join("")}</select></div>
      </div>` +
      (vis.length ? vis.map(cardAdmin).join("") : `<p class="vacio">No hay solicitudes ${filtroEstado ? "con estado «" + filtroEstado + "»" : ""} para mostrar.</p>`);
  };

  // No re-dibujar mientras el administrador escribe un comentario
  const refrescar = () => {
    renderColabs();
    const a = document.activeElement;
    if (a && panel.contains(a) && a.tagName === "TEXTAREA" && a.value) return;
    renderPanel();
  };

  listaEl.addEventListener("click", e => {
    const b = e.target.closest("[data-ced]");
    if (!b) return;
    sel = b.dataset.ced; renderColabs(); renderPanel();
  });
  buscar.addEventListener("input", renderColabs);
  panel.addEventListener("change", e => {
    if (e.target.id === "filtro-est-adm") { filtroEstado = e.target.value; renderPanel(); }
  });

  panel.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const card = b.closest(".sol-card");
    const s = sols.find(x => x.id === card.dataset.id);
    if (!s) return;
    const act = b.dataset.act;
    const files = [...(card.querySelector(".fil")?.files || [])];
    const com = card.querySelector(".com")?.value.trim() || "";

    if (act === "No autorizada" && !com) return alerta(al, "Escriba un comentario explicando por qué no se autoriza.");
    if (act === "subir" && !files.length) return alerta(al, "Seleccione al menos un archivo para subir.");
    const err = errorArchivos(files);
    if (err) return alerta(al, err);

    const textoOriginal = b.textContent;
    card.querySelectorAll("button").forEach(x => x.disabled = true);
    try {
      const nuevos = await subirVarios(files, "administración", (i, n) => b.textContent = `Subiendo ${i} de ${n}...`);
      const now = new Date().toISOString();
      const data = { adjuntosAdmin: [...(s.adjuntosAdmin || []), ...nuevos], actualizadoEn: now };
      if (act === "Autorizada" || act === "No autorizada") {
        data.estado = act;
        data.respuesta = { comentario: com, fecha: now, por: "Administración" };
      } else if (act === "reabrir") {
        data.estado = "Pendiente"; data.respuesta = null;
      }
      await updateDoc(doc(db, COL, s.id), data);
      await registrarBitacora("Solicitud gestionada", `${act} — ${s.tipo} de ${s.nombre} (${s.cedula})`);
      alerta(al, act === "subir" ? "Documento(s) subido(s) correctamente." : "Solicitud actualizada correctamente.", "ok");
    } catch (er) {
      console.error(er);
      alerta(al, "No se pudo completar la acción: " + (er.message || "intente de nuevo."));
      card.querySelectorAll("button").forEach(x => x.disabled = false);
      b.textContent = textoOriginal;
    }
  });

  try {
    trabajadores = await obtenerTodosTrabajadores();
  } catch (er) {
    return alerta(al, "No se pudo cargar la lista de colaboradores: " + er.message);
  }
  renderColabs(); renderPanel();
  onSnapshot(collection(db, COL),
    snap => { sols = snap.docs.map(d => ({ id: d.id, ...d.data() })); refrescar(); },
    er => alerta(al, "No se pudieron cargar las solicitudes: " + er.message));
}

const pagina = document.body.dataset.page;
if (pagina === "solicitudes") paginaTrabajador();
else if (pagina === "adminsol") paginaAdmin();
