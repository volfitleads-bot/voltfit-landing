/* =========================================================
   VoltFit v2 - Reingenieria
   - Sin categoria derivada (CR-01)
   - Sin estado de seguimiento (CR-04)
   - UPSERT en lugar de bloqueo de duplicados (CR-05)
   - Prioridad: si ubicacion contiene Toluca/Metepec/Estado de Mexico = Alta (CR-03)
   - Diseno renovado (CR-06)
   ========================================================= */

const SUPABASE_URL = "https://fhjgynhjxsvxtgzlovlb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoamd5bmhqeHN2eHRnemxvdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4OTEwMDIsImV4cCI6MjA5NDQ2NzAwMn0.0IehIW_NBHDPMEDqnpkH7i4vooxV6xTGVdA6R3BRnTk";
const TABLA_LEADS = "leads";

function esEmailValido(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); }
function esTelefonoValido(tel) { return /^[0-9]{10}$/.test(tel); }
function mostrarError(id, msg) {
  const input = document.getElementById(id);
  const err = document.getElementById("err-" + id);
  if (input) input.classList.add("is-invalid");
  if (err) err.textContent = msg;
}
function limpiarErrores() {
  document.querySelectorAll(".is-invalid").forEach(el => el.classList.remove("is-invalid"));
  document.querySelectorAll(".field__error").forEach(el => el.textContent = "");
}

// CR-03: prioridad por ubicacion
function calcularPrioridad(datos) {
  const u = (datos.ubicacion || "").toLowerCase();
  if (u.includes("toluca") || u.includes("metepec") ||
      u.includes("estado de mexico") ||
      u.includes("mexico")) {
    return "Alta";
  }
  if (datos.interes === "Membresia Premium" || datos.interes === "Conjuntos completos") return "Alta";
  if (datos.interes === "Accesorios" || datos.interes === "Otro") return "Baja";
  return "Media";
}

// CR-05: UPSERT (en lugar de bloqueo)
async function enviarLead(payload) {
  const url = `${SUPABASE_URL}/rest/v1/${TABLA_LEADS}?on_conflict=correo`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal,resolution=merge-duplicates"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase error (${res.status}): ${txt}`);
  }
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const form = document.getElementById("leadForm");
  const submitBtn = document.getElementById("submitBtn");
  const statusBox = document.getElementById("formStatus");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarErrores();
    statusBox.hidden = true;

    const datos = {
      nombre: document.getElementById("nombre").value.trim(),
      correo: document.getElementById("correo").value.trim().toLowerCase(),
      telefono: document.getElementById("telefono").value.trim(),
      tipo_cliente: document.getElementById("tipo_cliente").value,
      ubicacion: document.getElementById("ubicacion").value.trim(),
      interes: document.getElementById("interes").value,
      comentarios: document.getElementById("comentarios").value.trim(),
      consentimiento: document.getElementById("consentimiento").checked
    };

    let err = false;
    if (datos.nombre.length < 3) { mostrarError("nombre", "Ingresa tu nombre completo."); err = true; }
    if (!esEmailValido(datos.correo)) { mostrarError("correo", "Correo no valido."); err = true; }
    if (!esTelefonoValido(datos.telefono)) { mostrarError("telefono", "Debe tener 10 digitos."); err = true; }
    if (!datos.tipo_cliente) { mostrarError("tipo_cliente", "Selecciona una opcion."); err = true; }
    if (!datos.ubicacion) { mostrarError("ubicacion", "Ingresa tu ciudad o estado."); err = true; }
    if (!datos.interes) { mostrarError("interes", "Selecciona un producto."); err = true; }
    if (!datos.consentimiento) { mostrarError("consentimiento", "Debes aceptar el aviso de privacidad."); err = true; }
    if (err) return;

    const prioridad = calcularPrioridad(datos);

    const payload = {
      nombre: datos.nombre,
      correo: datos.correo,
      telefono: datos.telefono,
      tipo_cliente: datos.tipo_cliente,
      ubicacion: datos.ubicacion,
      interes: datos.interes,
      comentarios: datos.comentarios || null,
      consentimiento: datos.consentimiento,
      prioridad: prioridad,
      notificado: false
    };

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando...";
      await enviarLead(payload);
      statusBox.hidden = false;
      statusBox.className = "form-status success";
      statusBox.textContent = "Gracias. Te hemos registrado. Nuestro equipo te contactara pronto.";
      form.reset();
    } catch (err) {
      console.error(err);
      statusBox.hidden = false;
      statusBox.className = "form-status error";
      statusBox.textContent = "Ocurrio un error al enviar. Revisa tu conexion e intentalo de nuevo.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar solicitud";
    }
  });
});
