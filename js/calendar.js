/*
  ============================================================
  calendar.js — Módulo de Calendario de Vencimientos
  ============================================================
  Construye un calendario mensual interactivo con CSS/JS puro.
  Muestra vencimientos de pagos, servicios y contratos con
  indicadores de color según urgencia.

  Conceptos usados:
  - Date API de JavaScript para manejo de fechas
  - DOM dinámico con createElement / innerHTML
  - Array methods: filter, map, forEach
  ============================================================
*/

// ============================================================
// ESTADO DEL CALENDARIO
// ============================================================

// Guardamos el mes y año actual que se está mostrando
let calendarDate = new Date();

/**
 * Inicializa el calendario.
 * Se llama desde admin.js al cargar la sección de calendario.
 */
function initCalendar() {
  renderCalendar();
  renderEventList();
}

// ============================================================
// RENDERIZADO PRINCIPAL DEL CALENDARIO
// ============================================================

/**
 * Renderiza el calendario completo (encabezado + grilla de días).
 */
function renderCalendar() {
  const container = document.getElementById('calendarContainer');
  if (!container) return;

  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth(); // 0-11

  // Nombre del mes en español
  const monthName = calendarDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  // Obtener todos los eventos del mes
  const eventos = getEventosDelMes(year, month);

  // Calcular los días
  const firstDay    = new Date(year, month, 1);
  const lastDay     = new Date(year, month + 1, 0); // día 0 del mes siguiente = último día del mes actual
  const totalDias   = lastDay.getDate();

  // getDay() devuelve 0=domingo, 1=lunes... ajustamos para semana que empieza el lunes
  let startDow = firstDay.getDay(); // 0=dom
  startDow = startDow === 0 ? 6 : startDow - 1; // Convertir a lunes=0

  const hoy = new Date();

  // Construir HTML del calendario
  container.innerHTML = `
    <!-- Header: mes y botones de navegación -->
    <div class="calendar-header">
      <button class="calendar-nav-btn" id="calPrev">
        <i data-lucide="chevron-left" style="width:16px;height:16px;"></i>
      </button>
      <h3 class="calendar-month-title">${monthName}</h3>
      <button class="calendar-nav-btn" id="calNext">
        <i data-lucide="chevron-right" style="width:16px;height:16px;"></i>
      </button>
    </div>

    <!-- Nombres de los días de la semana -->
    <div class="calendar-weekdays">
      ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d =>
        `<div class="calendar-weekday">${d}</div>`
      ).join('')}
    </div>

    <!-- Grilla de días -->
    <div class="calendar-grid" id="calendarGrid">
      ${buildCalendarGrid(year, month, startDow, totalDias, eventos, hoy)}
    </div>
  `;

  // Registrar eventos de los botones de navegación
  document.getElementById('calPrev').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
    renderEventList();
  });

  document.getElementById('calNext').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
    renderEventList();
  });

  initIcons();
}

/**
 * Construye el HTML de la grilla de días del calendario.
 * Retorna un string HTML con todas las celdas.
 */
function buildCalendarGrid(year, month, startDow, totalDias, eventos, hoy) {
  let html = '';

  // Celdas vacías al inicio (para alinear el primer día con su día de semana)
  for (let i = 0; i < startDow; i++) {
    html += `<div class="calendar-day other-month"></div>`;
  }

  // Celdas de los días del mes
  for (let dia = 1; dia <= totalDias; dia++) {
    const fechaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const esHoy = (hoy.getFullYear() === year && hoy.getMonth() === month && hoy.getDate() === dia);

    // Buscar eventos en este día
    const eventosDelDia = eventos.filter(e => e.fecha === fechaStr);

    // Determinar clase de evento más urgente para colorear la celda
    let claseEvento = '';
    if (eventosDelDia.some(e => e.urgencia === 'danger'))  claseEvento = 'event-danger';
    else if (eventosDelDia.some(e => e.urgencia === 'warning')) claseEvento = 'event-warning';
    else if (eventosDelDia.length > 0) claseEvento = 'event-success';

    // Dots de colores (uno por evento)
    const dots = eventosDelDia.map(e =>
      `<div class="calendar-day-dot dot-${e.urgencia || 'info'}"></div>`
    ).join('');

    // Tooltip con info de los eventos del día
    const tooltipContent = eventosDelDia.map(e =>
      `<div class="tooltip-event">📍 ${e.titulo}</div>`
    ).join('');

    const tooltip = eventosDelDia.length > 0
      ? `<div class="calendar-day-tooltip">${tooltipContent}</div>`
      : '';

    html += `
      <div class="calendar-day ${esHoy ? 'today' : ''} ${eventosDelDia.length > 0 ? 'has-event' : ''} ${claseEvento}">
        ${dia}
        ${dots ? `<div class="calendar-day-dots">${dots}</div>` : ''}
        ${tooltip}
      </div>
    `;
  }

  return html;
}

// ============================================================
// OBTENER EVENTOS DEL MES
// ============================================================

/**
 * Recopila todos los eventos (vencimientos) del mes dado.
 * Combina pagos pendientes, vencimientos de servicios y contratos.
 *
 * @param {number} year
 * @param {number} month - 0-11
 * @returns {Array} Lista de eventos con { fecha, titulo, urgencia }
 */
function getEventosDelMes(year, month) {
  const eventos = [];
  const inquilinos = getInquilinos();
  const pagos = getPagos();

  inquilinos.forEach(inq => {
    if (!inq.activo) return;

    // ---- Vencimientos de servicios ----
    if (inq.servicios) {
      ['luz', 'agua', 'gas'].forEach(servicio => {
        const srv = inq.servicios[servicio];
        if (!srv || !srv.vencimiento) return;

        const fechaObj = new Date(srv.vencimiento + 'T00:00:00');
        if (fechaObj.getFullYear() === year && fechaObj.getMonth() === month) {
          let urgencia = 'success';
          if (srv.estado === 'atrasado')  urgencia = 'danger';
          if (srv.estado === 'pendiente') urgencia = 'warning';

          eventos.push({
            fecha:   srv.vencimiento,
            titulo:  `${inq.nombre} - ${servicio.charAt(0).toUpperCase() + servicio.slice(1)}`,
            urgencia,
            tipo: 'servicio'
          });
        }
      });
    }

    // ---- Vencimiento del contrato ----
    if (inq.fechaVencimiento) {
      const fechaVenc = new Date(inq.fechaVencimiento + 'T00:00:00');
      if (fechaVenc.getFullYear() === year && fechaVenc.getMonth() === month) {
        const diasRestantes = diasHasta(inq.fechaVencimiento);
        eventos.push({
          fecha:   inq.fechaVencimiento,
          titulo:  `Contrato ${inq.nombre} ${inq.apellido} vence`,
          urgencia: diasRestantes <= 30 ? 'danger' : (diasRestantes <= 90 ? 'warning' : 'info'),
          tipo: 'contrato'
        });
      }
    }
  });

  // ---- Pagos pendientes ----
  pagos.forEach(pago => {
    if (pago.estado === 'pendiente') {
      const fechaObj = new Date(pago.fecha + 'T00:00:00');
      if (fechaObj.getFullYear() === year && fechaObj.getMonth() === month) {
        eventos.push({
          fecha:   pago.fecha,
          titulo:  `Pago pendiente: ${pago.inquilinoNombre}`,
          urgencia: 'warning',
          tipo: 'pago'
        });
      }
    }
  });

  return eventos;
}

// ============================================================
// LISTA DE PRÓXIMOS EVENTOS
// ============================================================

/**
 * Renderiza la lista de próximos vencimientos en el panel lateral.
 */
function renderEventList() {
  const listEl = document.getElementById('calendarEventList');
  if (!listEl) return;

  // Recopilar eventos de los próximos 60 días
  const hoy = new Date();
  const eventos = [];
  const inquilinos = getInquilinos();

  inquilinos.forEach(inq => {
    if (!inq.activo) return;

    // Servicios
    if (inq.servicios) {
      ['luz', 'agua', 'gas'].forEach(srv => {
        const s = inq.servicios[srv];
        if (!s || !s.vencimiento) return;
        const dias = diasHasta(s.vencimiento);
        if (dias >= -5 && dias <= 60) {
          eventos.push({
            fecha:   s.vencimiento,
            titulo:  `${inq.nombre} — ${srv.charAt(0).toUpperCase() + srv.slice(1)}`,
            subtitulo: s.estado === 'pagado' ? 'Pagado' : (dias < 0 ? `Vencido hace ${-dias} días` : `En ${dias} días`),
            urgencia: s.estado === 'atrasado' ? 'danger' : (s.estado === 'pendiente' ? 'warning' : 'success'),
            dias
          });
        }
      });
    }

    // Contratos próximos a vencer
    if (inq.fechaVencimiento) {
      const dias = diasHasta(inq.fechaVencimiento);
      if (dias >= 0 && dias <= 180) {
        eventos.push({
          fecha: inq.fechaVencimiento,
          titulo: `Contrato: ${inq.nombre} ${inq.apellido}`,
          subtitulo: `Vence en ${dias} días (${inq.unidad})`,
          urgencia: dias <= 30 ? 'danger' : (dias <= 90 ? 'warning' : 'info'),
          dias
        });
      }
    }
  });

  // Ordenar por cercanía
  eventos.sort((a, b) => a.dias - b.dias);

  if (eventos.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:30px 15px;">
        <p style="color:var(--text-muted);font-size:0.875rem;text-align:center;">
          No hay vencimientos próximos
        </p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = eventos.slice(0, 10).map(ev => `
    <div class="event-item">
      <div class="event-color-bar ${ev.urgencia}"></div>
      <div class="event-info">
        <div class="event-title">${ev.titulo}</div>
        <div class="event-date">${formatearFecha(ev.fecha)} · ${ev.subtitulo}</div>
      </div>
    </div>
  `).join('');
}
