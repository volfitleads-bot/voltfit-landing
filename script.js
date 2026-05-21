/* =========================================================
   VoltFit — Lógica del formulario de captación de leads
   Envía datos a Supabase (PostgreSQL) vía API REST.
   Supabase dispara después un Edge Function que:
     1. Clasifica el lead
     2. Lo envía a HubSpot CRM
     3. Envía correo a equipo comercial vía Brevo
   ========================================================= */

// ============= 1) CONFIGURACIÓN =============
// IMPORTANTE: Reemplaza estos valores con los de TU proyecto Supabase
// Los obtienes en: Supabase → Project Settings → API
const SUPABASE_URL = "https://fhjgynhjxsvxtgzlovlb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoamd5bmhqeHN2eHRnemxvdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4OTEwMDIsImV4cCI6MjA5NDQ2NzAwMn0.0IehIW_NBHDPMEDqnpkH7i4vooxV6xTGVdA6R3BRnTk";

// Nombre de la tabla en Supabase
const TABLA_LEADS = "leads";

// ============= 2) HELPERS DE VALIDACIÓN =============

/**
 * Valida un email con expresión regular básica.
 */
function esEmailValido(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return regex.test(email);
}

/**
 * Valida un teléfono mexicano de 10 dígitos.
 */
function esTelefonoValido(tel) {
  return /^[0-9]{10}$/.test(tel);
}

/**
 * Pinta un error debajo del campo.
 */
function mostrarError(idCampo, mensaje) {
  const input = document.getElementById(idCampo);
  const err = document.getElementById("err-" + idCampo);
  if (input) input.classList.add("is-invalid");
  if (err) err.textContent = mensaje;
}

/**
 * Limpia los errores visibles.
 */
function limpiarErrores() {
  document.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  document.querySelectorAll(".field__error").forEach((el) => (el.textContent = ""));
}

// ============= 3) CLASIFICACIÓN DEL LEAD (en el cliente) =============
/**
 * Aplica reglas simples para clasificar el lead ANTES de enviarlo.
 * Estas mismas reglas se replican en el Edge Function de Supabase
 * por si alguien manda datos sin pasar por esta UI.
 */
function clasificarLead(datos) {
  let categoria = "General";
  let prioridad = "Media";
  let zona = "Otra";

  // Categoría por tipo de cliente
  if (datos.tipo_cliente === "Empresa") categoria = "Empresarial";
  else if (datos.tipo_cliente === "Persona") categoria = "Personal";

  // Prioridad por interés
  if (datos.interes === "Membresía Premium" || datos.interes === "Conjuntos completos") {
    prioridad = "Alta";
  } else if (datos.interes === "Accesorios" || datos.interes === "Otro") {
    prioridad = "Baja";
  }

  // Zona por ubicación
  const ubic = (datos.ubicacion || "").toLowerCase();
  if (ubic.includes("toluca") || ubic.includes("metepec")) zona = "Centro";
  else if (ubic.includes("cdmx") || ubic.includes("ciudad de méxico")) zona = "Metropolitana";
  else if (ubic.includes("monterrey") || ubic.includes("guadalajara")) zona = "Norte/Bajío";

  return { categoria, prioridad, zona };
}

// ============= 4) LÓGICA DE ENVÍO =============

/**
 * Envía el lead a Supabase usando su REST API.
 * Documentación: https://supabase.com/docs/guides/api
 */
async function enviarLeadASupabase(datosLead) {
  const url = `${SUPABASE_URL}/rest/v1/${TABLA_LEADS}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(datosLead)
  });

  if (!response.ok) {
    const errorTxt = await response.text();
    // 409 = conflicto: correo o teléfono ya registrado (duplicado)
    if (response.status === 409 || errorTxt.includes("23505") || errorTxt.includes("duplicate")) {
      const err = new Error("Registro duplicado");
      err.esDuplicado = true;
      throw err;
    }
    throw new Error(`Supabase error (${response.status}): ${errorTxt}`);
  }
  return true;
}

// ============= 5) MANEJO DEL FORMULARIO =============

document.addEventListener("DOMContentLoaded", () => {

  // Año actual en el footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ===== Click en tarjeta de producto: preselecciona el dropdown =====
  document.querySelectorAll(".product-card[data-product]").forEach((card) => {
    card.addEventListener("click", () => {
      const producto = card.getAttribute("data-product");
      const select = document.getElementById("interes");
      if (select && producto) {
        select.value = producto;
        select.dispatchEvent(new Event("change"));
        // Scroll suave al formulario
        document.getElementById("contacto").scrollIntoView({ behavior: "smooth", block: "center" });
        // Flash visual en el campo
        select.classList.add("just-selected");
        setTimeout(() => select.classList.remove("just-selected"), 1500);
      }
    });
  });

  // ===== Contadores animados en sección stats =====
  const animarContador = (el) => {
    const target = parseInt(el.getAttribute("data-target"), 10);
    let current = 0;
    const increment = Math.max(1, Math.ceil(target / 60));
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      el.textContent = current;
    }, 25);
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.classList.contains("stat__number") && !el.dataset.counted) {
            el.dataset.counted = "true";
            animarContador(el);
          }
          el.classList.add("visible");
        }
      });
    }, { threshold: 0.2 });

    document.querySelectorAll(".stat__number, .fade-in").forEach((el) => observer.observe(el));
  }

  const form = document.getElementById("leadForm");
  const submitBtn = document.getElementById("submitBtn");
  const statusBox = document.getElementById("formStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarErrores();
    statusBox.hidden = true;

    // Tomar los valores del formulario
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

    // ----- Validaciones -----
    let hayError = false;
    if (datos.nombre.length < 3) {
      mostrarError("nombre", "Ingresa tu nombre completo.");
      hayError = true;
    }
    if (!esEmailValido(datos.correo)) {
      mostrarError("correo", "Correo no válido.");
      hayError = true;
    }
    if (!esTelefonoValido(datos.telefono)) {
      mostrarError("telefono", "Debe tener 10 dígitos, sólo números.");
      hayError = true;
    }
    if (!datos.tipo_cliente) {
      mostrarError("tipo_cliente", "Selecciona una opción.");
      hayError = true;
    }
    if (!datos.ubicacion) {
      mostrarError("ubicacion", "Ingresa tu ciudad o estado.");
      hayError = true;
    }
    if (!datos.interes) {
      mostrarError("interes", "Selecciona un producto.");
      hayError = true;
    }
    if (!datos.consentimiento) {
      mostrarError("consentimiento", "Debes aceptar el aviso de privacidad.");
      hayError = true;
    }

    if (hayError) return;

    // ----- Clasificación -----
    const clasif = clasificarLead(datos);

    // Estructura final que se guarda en la tabla 'leads'
    const payload = {
      nombre: datos.nombre,
      correo: datos.correo,
      telefono: datos.telefono,
      tipo_cliente: datos.tipo_cliente,
      ubicacion: datos.ubicacion,
      interes: datos.interes,
      comentarios: datos.comentarios || null,
      consentimiento: datos.consentimiento,
      categoria: clasif.categoria,
      prioridad: clasif.prioridad,
      zona: clasif.zona,
      origen: "Landing Page VoltFit",
      estado: "Nuevo"
    };

    // ----- Envío -----
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando...";

      await enviarLeadASupabase(payload);

      // Éxito
      statusBox.hidden = false;
      statusBox.className = "form-status success";
      statusBox.textContent = "✅ ¡Gracias! Te hemos registrado. Nuestro equipo te contactará pronto.";
      form.reset();
    } catch (err) {
      console.error(err);
      statusBox.hidden = false;
      statusBox.className = "form-status error";
      if (err.esDuplicado) {
        // Mensaje amable cuando el correo o teléfono ya existe
        statusBox.className = "form-status info";
        statusBox.textContent = "📋 Este correo o teléfono ya está registrado. ¡Gracias, ya te tenemos en nuestra lista y te contactaremos pronto!";
      } else {
        statusBox.textContent = "❌ Ocurrió un error al enviar. Revisa tu conexión e inténtalo de nuevo.";
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar";
    }
  });
});
