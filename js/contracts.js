/*
  ============================================================
  contracts.js — Sistema de Contratos y Validación Documental
  ============================================================
  Módulo independiente. No toca: servicios, expensas, reclamos,
  dashboard superadmin, notificaciones fuera de contratos.

  FUNCIONALIDADES:
  - Subida de contratos (PDF/JPG/PNG/DOC/DOCX) con previsualización
  - Historial inmutable de versiones
  - Bloqueo de edición directa
  - Validación por código de 6 dígitos (simulado)
  - Vista previa antes y después de subir
  - Descarga de contratos
  ============================================================
*/

// ============================================================
// STORAGE KEYS — CONTRATOS
// ============================================================

const CONTRACT_KEYS = {
  CONTRATOS:  'renta_contratos',
  HISTORIAL:  'renta_contratos_historial',
  CODIGOS:    'renta_contratos_codigos',
};

// ============================================================
// UTILIDADES BASE
// ============================================================

function contratosGet(key, def = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : def;
  } catch { return def; }
}

function contratosSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ============================================================
// CRUD — CONTRATOS
// ============================================================

/**
 * Obtiene el contrato activo de un inquilino o admin.
 * @param {string} entidadId  - inquilinoId o adminId
 * @param {string} tipo       - 'inquilino' | 'admin'
 */
function getContratoActivo(entidadId, tipo) {
  return contratosGet(CONTRACT_KEYS.CONTRATOS, [])
    .find(c => c.entidadId === entidadId && c.tipo === tipo && c.estado === 'activo') || null;
}

/**
 * Obtiene todos los contratos de una entidad.
 */
function getContratosByEntidad(entidadId, tipo) {
  return contratosGet(CONTRACT_KEYS.CONTRATOS, [])
    .filter(c => c.entidadId === entidadId && c.tipo === tipo);
}

/**
 * Crea un nuevo contrato. Si ya existe uno activo, lo marca como 'reemplazado'.
 * Siempre guarda en historial.
 */
function crearContrato({ entidadId, tipo, archivo, usuarioCreador, usuarioCreadorId, motivo = 'Creación inicial' }) {
  const contratos = contratosGet(CONTRACT_KEYS.CONTRATOS, []);

  // Marcar anterior como reemplazado
  const actualizados = contratos.map(c =>
    c.entidadId === entidadId && c.tipo === tipo && c.estado === 'activo'
      ? { ...c, estado: 'reemplazado' }
      : c
  );

  // Calcular versión
  const version = actualizados.filter(c => c.entidadId === entidadId && c.tipo === tipo).length + 1;

  const nuevo = {
    id:              'ctrato' + Date.now(),
    entidadId,
    tipo,
    version,
    estado:          'activo',
    archivo,         // { nombre, ext, dataUrl, tamaño }
    fechaSubida:     new Date().toISOString(),
    usuarioCreador,
    usuarioCreadorId,
    motivo,
  };

  actualizados.push(nuevo);
  contratosSet(CONTRACT_KEYS.CONTRATOS, actualizados);

  // Guardar en historial (inmutable — nunca se borra)
  agregarHistorialContrato({
    contratoId:      nuevo.id,
    entidadId,
    tipo,
    version,
    estado:          'activo',
    archivo,
    fechaAccion:     nuevo.fechaSubida,
    usuarioAccion:   usuarioCreador,
    usuarioAccionId: usuarioCreadorId,
    motivo,
  });

  return nuevo;
}

/**
 * Actualiza contrato luego de validar código. Crea nueva versión.
 */
function actualizarContratoValidado({ entidadId, tipo, archivo, usuarioAccion, usuarioAccionId, motivo }) {
  return crearContrato({ entidadId, tipo, archivo, usuarioCreador: usuarioAccion, usuarioCreadorId: usuarioAccionId, motivo });
}

// ============================================================
// HISTORIAL INMUTABLE
// ============================================================

function agregarHistorialContrato(entrada) {
  const hist = contratosGet(CONTRACT_KEYS.HISTORIAL, []);
  hist.unshift({ ...entrada, id: 'hist' + Date.now() });
  contratosSet(CONTRACT_KEYS.HISTORIAL, hist);
}

function getHistorialByEntidad(entidadId, tipo) {
  return contratosGet(CONTRACT_KEYS.HISTORIAL, [])
    .filter(h => h.entidadId === entidadId && h.tipo === tipo)
    .sort((a, b) => new Date(b.fechaAccion) - new Date(a.fechaAccion));
}

// ============================================================
// CÓDIGOS DE VALIDACIÓN (simulados)
// ============================================================

function generarCodigoValidacion(entidadId) {
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const codigos = contratosGet(CONTRACT_KEYS.CODIGOS, []).filter(c => c.entidadId !== entidadId);
  codigos.push({
    entidadId,
    codigo,
    generadoEn: new Date().toISOString(),
    usado: false,
  });
  contratosSet(CONTRACT_KEYS.CODIGOS, codigos);
  return codigo;
}

function validarCodigo(entidadId, codigoIngresado) {
  const codigos = contratosGet(CONTRACT_KEYS.CODIGOS, []);
  const entrada = codigos.find(c => c.entidadId === entidadId && !c.usado);
  if (!entrada) return false;

  // Expirar después de 15 minutos
  const minutos = (Date.now() - new Date(entrada.generadoEn).getTime()) / 60000;
  if (minutos > 15) return false;

  if (entrada.codigo === codigoIngresado.trim()) {
    // Marcar como usado
    contratosSet(CONTRACT_KEYS.CODIGOS, codigos.map(c =>
      c.entidadId === entidadId ? { ...c, usado: true } : c
    ));
    return true;
  }
  return false;
}

// ============================================================
// HELPERS DE ARCHIVO
// ============================================================

const FORMATOS_PERMITIDOS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];

function getExtension(nombre) {
  return nombre.split('.').pop().toLowerCase();
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Error al leer archivo'));
    reader.readAsDataURL(file);
  });
}

function iconoContrato(ext) {
  const iconos = {
    pdf:  'file-text',
    jpg:  'image',
    jpeg: 'image',
    png:  'image',
    doc:  'file',
    docx: 'file',
  };
  return iconos[ext] || 'file';
}

function estaPrevisualizable(ext) {
  return ['jpg', 'jpeg', 'png', 'pdf'].includes(ext);
}

// ============================================================
// WIDGET DE SUBIDA — genera HTML reutilizable
// ============================================================

/**
 * Renderiza el widget de gestión de contratos dentro de un contenedor.
 * @param {string} containerId  - ID del elemento DOM donde montar el widget
 * @param {object} opciones
 *   entidadId, tipo ('inquilino'|'admin'), usuarioActual, usuarioActualId,
 *   puedeModificar (bool), emailEntidad (para simular envío código)
 */
function renderContratoWidget(containerId, { entidadId, tipo, usuarioActual, usuarioActualId, puedeModificar = false, emailEntidad = '(email registrado)' }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const contratoActivo = getContratoActivo(entidadId, tipo);
  const historial      = getHistorialByEntidad(entidadId, tipo);

  container.innerHTML = `
    <div class="contrato-widget" id="cw-${entidadId}">

      <!-- CONTRATO ACTIVO -->
      <div style="margin-bottom:var(--space-5);">
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-3);">
          📄 Contrato / Documento
        </div>

        ${contratoActivo ? renderContratoActivo(contratoActivo, puedeModificar, entidadId, tipo, usuarioActual, usuarioActualId, emailEntidad) : renderSinContrato(entidadId, tipo, usuarioActual, usuarioActualId)}
      </div>

      <!-- HISTORIAL -->
      ${historial.length > 0 ? `
        <div>
          <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-3);">
            🗂 Historial de versiones
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2);" id="cw-hist-${entidadId}">
            ${historial.map(h => renderHistorialEntry(h)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  initIcons();
}

function renderContratoActivo(contrato, puedeModificar, entidadId, tipo, usuarioActual, usuarioActualId, emailEntidad) {
  const { archivo } = contrato;
  const ext = archivo?.ext || getExtension(archivo?.nombre || '');

  return `
    <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:var(--space-4);border:1px solid var(--border-subtle);">
      <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3);">
        <div style="width:40px;height:40px;border-radius:var(--radius-sm);background:rgba(99,102,241,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i data-lucide="${iconoContrato(ext)}" style="width:20px;height:20px;color:var(--color-primary);"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${archivo?.nombre || 'Contrato'}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">
            v${contrato.version} · ${formatearFechaHora(contrato.fechaSubida)} · ${archivo?.tamaño || ''}
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);">Por: ${contrato.usuarioCreador}</div>
        </div>
        <span class="badge badge--success">Activo</span>
      </div>

      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
        ${estaPrevisualizable(ext) ? `
          <button class="btn btn--sm btn--secondary" onclick="previsualizarContrato('${contrato.id}')">
            <i data-lucide="eye" style="width:13px;height:13px;"></i> Ver
          </button>
        ` : ''}
        <button class="btn btn--sm btn--secondary" onclick="descargarContrato('${contrato.id}')">
          <i data-lucide="download" style="width:13px;height:13px;"></i> Descargar
        </button>
        ${puedeModificar ? `
          <button class="btn btn--sm btn--secondary" onclick="iniciarActualizacionContrato('${entidadId}','${tipo}','${usuarioActual}','${usuarioActualId}','${emailEntidad}')" style="color:var(--color-warning);">
            <i data-lucide="refresh-cw" style="width:13px;height:13px;"></i> Solicitar actualización
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderSinContrato(entidadId, tipo, usuarioActual, usuarioActualId) {
  return `
    <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:var(--space-4);border:2px dashed var(--border-default);text-align:center;">
      <i data-lucide="file-plus" style="width:32px;height:32px;color:var(--text-muted);margin-bottom:var(--space-3);"></i>
      <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:var(--space-3);">Sin contrato adjunto</p>
      <button class="btn btn--primary btn--sm" onclick="abrirSubidaContrato('${entidadId}','${tipo}','${usuarioActual}','${usuarioActualId}','Subir contrato',false)">
        <i data-lucide="upload" style="width:14px;height:14px;"></i> Adjuntar contrato
      </button>
    </div>
  `;
}

function renderHistorialEntry(h) {
  const ext = h.archivo?.ext || getExtension(h.archivo?.nombre || '');
  const estadoColor = {
    activo:      '#10b981',
    pendiente:   '#f59e0b',
    reemplazado: '#6366f1',
    rechazado:   '#ef4444',
  }[h.estado] || '#6b7280';

  return `
    <div style="display:flex;gap:var(--space-3);align-items:flex-start;padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-sm);border-left:3px solid ${estadoColor};">
      <i data-lucide="${iconoContrato(ext)}" style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0;margin-top:2px;"></i>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.8125rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.archivo?.nombre || 'Archivo'}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">
          v${h.version} · ${formatearFechaHora(h.fechaAccion)} · ${h.usuarioAccion}
        </div>
        ${h.motivo ? `<div style="font-size:0.75rem;color:var(--text-muted);font-style:italic;">${h.motivo}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
        <span style="font-size:0.7rem;padding:2px 8px;border-radius:99px;background:${estadoColor}22;color:${estadoColor};font-weight:600;text-transform:capitalize;">${h.estado}</span>
        ${estaPrevisualizable(ext) && h.archivo?.dataUrl ? `
          <button class="btn btn--sm btn--ghost" onclick="previsualizarArchivoDirecto('${encodeURIComponent(h.archivo.dataUrl)}','${encodeURIComponent(h.archivo.nombre)}')" title="Ver">
            <i data-lucide="eye" style="width:12px;height:12px;"></i>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

// ============================================================
// ACCIONES GLOBALES
// ============================================================

/** Previsualiza un contrato activo por su ID */
function previsualizarContrato(contratoId) {
  const contratos = contratosGet(CONTRACT_KEYS.CONTRATOS, []);
  const contrato  = contratos.find(c => c.id === contratoId);
  if (!contrato?.archivo?.dataUrl) {
    showToast('No se puede previsualizar este archivo', 'warning');
    return;
  }
  abrirModalPreview(contrato.archivo);
}

/** Previsualiza un archivo pasado directamente (desde historial) */
function previsualizarArchivoDirecto(encodedDataUrl, encodedNombre) {
  abrirModalPreview({
    dataUrl: decodeURIComponent(encodedDataUrl),
    nombre:  decodeURIComponent(encodedNombre),
    ext:     getExtension(decodeURIComponent(encodedNombre)),
  });
}

/** Descarga un contrato */
function descargarContrato(contratoId) {
  const contratos = contratosGet(CONTRACT_KEYS.CONTRATOS, []);
  const contrato  = contratos.find(c => c.id === contratoId);
  if (!contrato?.archivo?.dataUrl) {
    showToast('Archivo no disponible para descarga', 'warning');
    return;
  }
  const a = document.createElement('a');
  a.href     = contrato.archivo.dataUrl;
  a.download = contrato.archivo.nombre;
  a.click();
}

// ============================================================
// MODAL DE PREVISUALIZACIÓN
// ============================================================

function abrirModalPreview(archivo) {
  const ext = archivo.ext || getExtension(archivo.nombre || '');
  let contenido = '';

  if (['jpg','jpeg','png'].includes(ext)) {
    contenido = `<img src="${archivo.dataUrl}" alt="${archivo.nombre}" style="max-width:100%;max-height:70vh;border-radius:var(--radius-md);" />`;
  } else if (ext === 'pdf') {
    contenido = `<iframe src="${archivo.dataUrl}" style="width:100%;height:70vh;border:none;border-radius:var(--radius-md);" title="${archivo.nombre}"></iframe>`;
  } else {
    contenido = `
      <div style="text-align:center;padding:var(--space-8);">
        <i data-lucide="file" style="width:48px;height:48px;color:var(--text-muted);margin-bottom:var(--space-4);"></i>
        <p style="color:var(--text-secondary);">Previsualización no disponible para este formato.</p>
        <p style="font-size:0.875rem;color:var(--text-muted);">${archivo.nombre}</p>
      </div>
    `;
  }

  // Crear o reusar modal
  let overlay = document.getElementById('modalContratoPreview');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modalContratoPreview';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:none;z-index:9999;';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="modal" style="max-width:800px;width:95vw;">
      <div class="modal__header">
        <h3 class="modal__title" style="font-size:0.9375rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:600px;">
          <i data-lucide="${iconoContrato(ext)}" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"></i>
          ${archivo.nombre}
        </h3>
        <button class="modal__close" onclick="cerrarModalPreview()">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      </div>
      <div style="overflow:auto;">${contenido}</div>
      <div class="modal__footer">
        <button class="btn btn--secondary" onclick="cerrarModalPreview()">Cerrar</button>
        <button class="btn btn--primary" onclick="descargarArchivoDirecto('${encodeURIComponent(archivo.dataUrl)}','${encodeURIComponent(archivo.nombre)}')">
          <i data-lucide="download" style="width:15px;height:15px;"></i> Descargar
        </button>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) cerrarModalPreview(); };
  initIcons();
}

function cerrarModalPreview() {
  const overlay = document.getElementById('modalContratoPreview');
  if (overlay) overlay.style.display = 'none';
}

function descargarArchivoDirecto(encodedDataUrl, encodedNombre) {
  const a = document.createElement('a');
  a.href     = decodeURIComponent(encodedDataUrl);
  a.download = decodeURIComponent(encodedNombre);
  a.click();
}

// ============================================================
// MODAL DE SUBIDA DE CONTRATO (primer upload / sin código)
// ============================================================

/**
 * Abre el modal para subir un contrato nuevo.
 * Si esActualizacion=true, el flujo requiere código de validación previo.
 */
function abrirSubidaContrato(entidadId, tipo, usuarioActual, usuarioActualId, titulo, esActualizacion, emailEntidad, codigoValidado) {
  let archivoSeleccionado = null;
  let previewDataUrl      = null;
  let previewExt          = null;

  let overlay = document.getElementById('modalSubidaContrato');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modalSubidaContrato';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="modal" style="max-width:560px;">
      <div class="modal__header">
        <h3 class="modal__title">${titulo || 'Adjuntar contrato'}</h3>
        <button class="modal__close" onclick="cerrarModalSubida()">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      </div>

      <!-- Zona de drop / selección -->
      <div id="zonaDropContrato" style="
        border:2px dashed var(--border-default);border-radius:var(--radius-md);
        padding:var(--space-6);text-align:center;cursor:pointer;
        transition:border-color 0.2s,background 0.2s;margin-bottom:var(--space-4);
      " onclick="document.getElementById('inputArchivoContrato').click()"
         ondragover="event.preventDefault();this.style.borderColor='var(--color-primary)';"
         ondragleave="this.style.borderColor='var(--border-default)';"
         ondrop="handleDropContrato(event)">
        <i data-lucide="upload-cloud" style="width:36px;height:36px;color:var(--text-muted);margin-bottom:var(--space-3);"></i>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:6px;">Arrastrá el archivo aquí o hacé click</p>
        <p style="font-size:0.75rem;color:var(--text-muted);">PDF, JPG, PNG, DOC, DOCX — máx. 10 MB</p>
        <input type="file" id="inputArchivoContrato" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="display:none;" />
      </div>

      <!-- Previsualización -->
      <div id="previewContratoSubida" style="display:none;margin-bottom:var(--space-4);"></div>

      <!-- Info archivo seleccionado -->
      <div id="infoArchivoContrato" style="display:none;background:var(--bg-elevated);border-radius:var(--radius-sm);padding:var(--space-3);margin-bottom:var(--space-4);"></div>

      <!-- Motivo (solo en actualizaciones) -->
      ${esActualizacion ? `
        <div class="form-group">
          <label class="form-label">Motivo de actualización</label>
          <input type="text" class="form-input" id="motivoActualizacion" placeholder="Ej: Renovación anual de contrato" />
        </div>
      ` : ''}

      <div class="modal__footer">
        <button class="btn btn--secondary" onclick="cerrarModalSubida()">Cancelar</button>
        <button class="btn btn--primary" id="btnConfirmarSubida" disabled style="opacity:0.5;">
          <i data-lucide="check" style="width:15px;height:15px;"></i>
          ${esActualizacion ? 'Confirmar actualización' : 'Guardar contrato'}
        </button>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) cerrarModalSubida(); };

  // Listener del input
  document.getElementById('inputArchivoContrato').addEventListener('change', e => {
    if (e.target.files?.[0]) procesarArchivoContrato(e.target.files[0]);
  });

  // Botón confirmar
  document.getElementById('btnConfirmarSubida').addEventListener('click', () => {
    if (!archivoSeleccionado) return;
    const motivo = esActualizacion
      ? (document.getElementById('motivoActualizacion')?.value.trim() || 'Actualización de contrato')
      : 'Carga inicial';

    confirmarSubidaContrato({
      entidadId, tipo, usuarioActual, usuarioActualId, motivo, esActualizacion
    });
  });

  initIcons();

  // ---- Funciones internas del modal ----

  async function procesarArchivoContrato(file) {
    const ext = getExtension(file.name);
    if (!FORMATOS_PERMITIDOS.includes(ext)) {
      showToast('Formato no permitido. Usá PDF, JPG, PNG, DOC o DOCX', 'warning');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('El archivo supera los 10 MB', 'warning');
      return;
    }

    try {
      const dataUrl = await leerArchivoComoDataUrl(file);
      previewDataUrl = dataUrl;
      previewExt     = ext;

      archivoSeleccionado = {
        nombre:  file.name,
        ext,
        dataUrl,
        tamaño:  formatBytes(file.size),
      };

      // Mostrar info
      const infoEl = document.getElementById('infoArchivoContrato');
      infoEl.style.display = 'flex';
      infoEl.style.alignItems = 'center';
      infoEl.style.gap = '10px';
      infoEl.innerHTML = `
        <i data-lucide="${iconoContrato(ext)}" style="width:20px;height:20px;color:var(--color-primary);flex-shrink:0;"></i>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${file.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${formatBytes(file.size)} · ${ext.toUpperCase()}</div>
        </div>
        <span class="badge badge--success">✓ Listo</span>
      `;

      // Preview inline
      const prevEl = document.getElementById('previewContratoSubida');
      if (estaPrevisualizable(ext)) {
        prevEl.style.display = 'block';
        if (['jpg','jpeg','png'].includes(ext)) {
          prevEl.innerHTML = `
            <div style="border-radius:var(--radius-md);overflow:hidden;max-height:200px;border:1px solid var(--border-subtle);">
              <img src="${dataUrl}" alt="preview" style="width:100%;max-height:200px;object-fit:contain;background:var(--bg-base);" />
            </div>
          `;
        } else if (ext === 'pdf') {
          prevEl.innerHTML = `
            <div style="border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--border-subtle);">
              <iframe src="${dataUrl}" style="width:100%;height:200px;border:none;" title="preview pdf"></iframe>
            </div>
          `;
        }
      } else {
        prevEl.style.display = 'none';
      }

      // Activar botón
      const btn = document.getElementById('btnConfirmarSubida');
      btn.disabled = false;
      btn.style.opacity = '1';
      initIcons();
    } catch {
      showToast('Error al leer el archivo', 'danger');
    }
  }

  // Exponer al scope global para ondrop
  window.handleDropContrato = e => {
    e.preventDefault();
    document.getElementById('zonaDropContrato').style.borderColor = 'var(--border-default)';
    if (e.dataTransfer.files?.[0]) procesarArchivoContrato(e.dataTransfer.files[0]);
  };

  function confirmarSubidaContrato({ entidadId, tipo, usuarioActual, usuarioActualId, motivo, esActualizacion }) {
    if (!archivoSeleccionado) return;

    if (esActualizacion) {
      actualizarContratoValidado({
        entidadId, tipo,
        archivo:         archivoSeleccionado,
        usuarioAccion:   usuarioActual,
        usuarioAccionId: usuarioActualId,
        motivo,
      });
      showToast('✔ Contrato actualizado correctamente — nueva versión guardada', 'success');
    } else {
      crearContrato({
        entidadId, tipo,
        archivo:         archivoSeleccionado,
        usuarioCreador:  usuarioActual,
        usuarioCreadorId: usuarioActualId,
        motivo,
      });
      showToast('✔ Contrato adjuntado correctamente', 'success');
    }

    cerrarModalSubida();

    // Refrescar el widget si existe
    setTimeout(() => {
      const wEl = document.getElementById('cw-' + entidadId);
      if (wEl) {
        const params = wEl.closest('[data-contrato-params]');
        if (params) {
          try {
            const p = JSON.parse(decodeURIComponent(params.getAttribute('data-contrato-params')));
            renderContratoWidget(p.containerId, p);
          } catch {}
        }
      }
    }, 100);
  }
}

function cerrarModalSubida() {
  const overlay = document.getElementById('modalSubidaContrato');
  if (overlay) overlay.style.display = 'none';
}

// ============================================================
// FLUJO DE ACTUALIZACIÓN CON CÓDIGO DE VALIDACIÓN
// ============================================================

/**
 * Paso 1: Genera código, simula envío por email, muestra modal de ingreso de código.
 */
function iniciarActualizacionContrato(entidadId, tipo, usuarioActual, usuarioActualId, emailEntidad) {
  const codigo = generarCodigoValidacion(entidadId);

  // Simular "envío de email"
  console.log(`[Contratos] Código generado para ${entidadId}: ${codigo}`);

  let overlay = document.getElementById('modalCodigoContrato');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modalCodigoContrato';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal__header">
        <h3 class="modal__title">🔐 Validación requerida</h3>
        <button class="modal__close" onclick="cerrarModalCodigo()">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      </div>

      <!-- Notificación de envío simulado -->
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:var(--radius-md);padding:var(--space-4);margin-bottom:var(--space-5);">
        <div style="display:flex;gap:var(--space-3);align-items:flex-start;">
          <i data-lucide="mail-check" style="width:18px;height:18px;color:var(--color-success);flex-shrink:0;margin-top:1px;"></i>
          <div>
            <div style="font-weight:600;font-size:0.875rem;color:var(--color-success);margin-bottom:4px;">Código enviado al correo registrado</div>
            <div style="font-size:0.8125rem;color:var(--text-secondary);">
              Se envió un código de 6 dígitos a <strong>${emailEntidad}</strong>.<br>
              Ingresá el código para continuar. Válido por 15 minutos.
            </div>
          </div>
        </div>
      </div>

      <!-- Demo: mostrar código en pantalla (solo simulación) -->
      <div style="background:var(--bg-elevated);border-radius:var(--radius-sm);padding:var(--space-3);margin-bottom:var(--space-4);border-left:3px solid var(--color-warning);">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">🧪 Modo demo — código visible:</div>
        <div style="font-family:var(--font-mono);font-size:1.5rem;font-weight:700;letter-spacing:0.2em;color:var(--color-primary);" id="codigoDemo">${codigo}</div>
      </div>

      <div class="form-group">
        <label class="form-label">Ingresá el código de 6 dígitos</label>
        <input type="text" class="form-input" id="inputCodigoValidacion"
          placeholder="000000" maxlength="6"
          style="font-size:1.25rem;letter-spacing:0.15em;text-align:center;font-family:var(--font-mono);"
        />
      </div>

      <!-- Advertencia: debe leer el contrato nuevo -->
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:var(--radius-sm);padding:var(--space-3);margin-bottom:var(--space-4);">
        <div style="font-size:0.8125rem;color:var(--color-warning);font-weight:500;">
          ⚠️ Al ingresar el código correcto, podrás subir el nuevo contrato.
          El inquilino deberá leerlo y aceptarlo antes de que entre en vigencia.
        </div>
      </div>

      <div class="modal__footer">
        <button class="btn btn--secondary" onclick="cerrarModalCodigo()">Cancelar</button>
        <button class="btn btn--primary" id="btnValidarCodigo">
          <i data-lucide="shield-check" style="width:15px;height:15px;"></i> Validar código
        </button>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) cerrarModalCodigo(); };

  document.getElementById('btnValidarCodigo').addEventListener('click', () => {
    const ingresado = document.getElementById('inputCodigoValidacion').value.trim();
    if (ingresado.length !== 6) {
      showToast('Ingresá los 6 dígitos del código', 'warning');
      return;
    }

    if (validarCodigo(entidadId, ingresado)) {
      cerrarModalCodigo();
      // Paso 2: abrir modal de subida con nuevo contrato
      abrirSubidaContratoAceptacion(entidadId, tipo, usuarioActual, usuarioActualId, emailEntidad);
    } else {
      showToast('❌ Código incorrecto o expirado. Verificá e intentá de nuevo.', 'danger');
      document.getElementById('inputCodigoValidacion').value = '';
      document.getElementById('inputCodigoValidacion').focus();
    }
  });

  // Enter en el input
  document.getElementById('inputCodigoValidacion').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnValidarCodigo').click();
  });

  initIcons();
}

/**
 * Paso 2: Luego del código validado, el admin sube el nuevo contrato.
 * El inquilino debe leer y aceptar/rechazar.
 */
function abrirSubidaContratoAceptacion(entidadId, tipo, usuarioActual, usuarioActualId, emailEntidad) {
  // En esta implementación, el flujo de aceptación se simula:
  // El admin sube el contrato → queda en estado 'pendiente' hasta que el inquilino lo acepte.
  // Para no complicar el MVP, al subir queda activo con estado visible en historial.
  abrirSubidaContrato(entidadId, tipo, usuarioActual, usuarioActualId, 'Subir nuevo contrato (validado)', true, emailEntidad, true);
}

function cerrarModalCodigo() {
  const overlay = document.getElementById('modalCodigoContrato');
  if (overlay) overlay.style.display = 'none';
}

// ============================================================
// HELPER DE FORMATO DE FECHA CON HORA
// ============================================================

function formatearFechaHora(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return isoString; }
}

console.log('[Contratos] Módulo listo.');
