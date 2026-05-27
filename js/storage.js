/*
  ============================================================
  storage.js — Capa de Abstracción de LocalStorage (FUSIONADO)
  ============================================================
  Roles soportados: superadmin / admin / inquilino

  Módulos integrados:
  - CRUD Admins, Inquilinos, Pagos, Reclamos, Avisos
  - Comprobantes, Notificaciones, Actividad
  - Reclamos Admin → SuperAdmin (RECLAMOS_SA)
  - Expensas por inquilino (admin crea, inquilino ve/paga)
  - Servicios Personales del inquilino
  - Contratos y Historial (gestionados por contracts.js)
  - Sesión, Autenticación, Usuarios Desactivados
  ============================================================
*/

// ============================================================
// CONSTANTES DE CLAVES DE LOCALSTORAGE
// ============================================================

const STORAGE_KEYS = {
  USUARIOS:              'renta_usuarios',
  ADMINS:                'renta_admins',
  INQUILINOS:            'renta_inquilinos',
  PAGOS:                 'renta_pagos',
  RECLAMOS:              'renta_reclamos',
  AVISOS:                'renta_avisos',
  NOTIFICACIONES:        'renta_notificaciones',
  COMPROBANTES:          'renta_comprobantes',
  ACTIVIDAD:             'renta_actividad',
  PROPIEDADES:           'renta_propiedades',
  SESION_ACTUAL:         'renta_sesion',
  USUARIOS_DESACTIVADOS: 'renta_usuarios_desactivados',
  RECLAMOS_SA:           'renta_reclamos_sa',
  EXPENSAS:              'renta_expensas',
  SERVICIOS_PERSONALES:  'renta_servicios_personales',
  // Contratos gestionados por contracts.js:
  // CONTRATOS:          'renta_contratos',
  // CONTRATOS_HIST:     'renta_contratos_historial',
};

// ============================================================
// FUNCIONES BASE
// ============================================================

function storageGet(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[Storage] Error al leer "${key}":`, err);
    return defaultValue;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[Storage] Error al guardar "${key}":`, err);
  }
}

function storageRemove(key) {
  localStorage.removeItem(key);
}

// ============================================================
// SEED DATA
// ============================================================

function initStorage() {
  if (storageGet(STORAGE_KEYS.USUARIOS)) return;
  console.log('[Storage] Primera ejecución. Cargando datos de ejemplo...');

  const usuarios = [
    {
      id: 'u000', email: 'superadmin@rentaadmin.com', dni: '40274516',
      password: 'super123', rol: 'superadmin', nombre: 'Diaz Enzo',
      avatar: 'DR', activo: true
    },
    {
      id: 'u001', email: 'admin@rentaadmin.com', dni: '20222222',
      password: 'admin123', rol: 'admin', nombre: 'Carlos Martínez',
      avatar: 'CM', adminId: 'adm001', activo: true
    },
    {
      id: 'u005', email: 'lucia.torres@rentaadmin.com', dni: '20333333',
      password: 'admin123', rol: 'admin', nombre: 'Lucía Torres',
      avatar: 'LT', adminId: 'adm002', activo: true
    },
    {
      id: 'u002', email: 'juan.perez@email.com', dni: '30444444',
      password: 'inquilino123', rol: 'inquilino', nombre: 'Juan Pérez',
      inquilinoId: 'inq001', avatar: 'JP', activo: true
    },
    {
      id: 'u003', email: 'maria.gomez@email.com', dni: '30555555',
      password: 'inquilino123', rol: 'inquilino', nombre: 'María Gómez',
      inquilinoId: 'inq002', avatar: 'MG', activo: true
    },
    {
      id: 'u004', email: 'roberto.silva@email.com', dni: '30666666',
      password: 'inquilino123', rol: 'inquilino', nombre: 'Roberto Silva',
      inquilinoId: 'inq003', avatar: 'RS', activo: true
    },
  ];

  const admins = [
    {
      id: 'adm001', usuarioId: 'u001', nombre: 'Carlos Martínez',
      email: 'admin@rentaadmin.com', dni: '20222222', telefono: '+54 9 11 1111-2222',
      empresa: 'Inmobiliaria Martínez', plan: 'pro',
      fechaAlta: '2024-01-15', fechaInicioContrato: '2024-01-15', estado: 'activo',
    },
    {
      id: 'adm002', usuarioId: 'u005', nombre: 'Lucía Torres',
      email: 'lucia.torres@rentaadmin.com', dni: '20333333', telefono: '+54 9 11 3333-4444',
      empresa: 'Torres Propiedades', plan: 'basico',
      fechaAlta: '2024-03-01', fechaInicioContrato: '2024-03-01', estado: 'activo',
    },
  ];

  const today = new Date();
  const addMonths = (d, m) => {
    const r = new Date(d);
    r.setMonth(r.getMonth() + m);
    return r.toISOString().split('T')[0];
  };
  const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r.toISOString().split('T')[0];
  };
  const todayStr = today.toISOString().split('T')[0];

  const inquilinos = [
    {
      id: 'inq001', adminId: 'adm001', adminNombre: 'Carlos Martínez',
      nombre: 'Juan', apellido: 'Pérez', email: 'juan.perez@email.com',
      dni: '30444444', telefono: '+54 9 11 4444-5555', unidad: 'Depto 2A',
      valorAlquiler: 180000, metodoPago: 'Transferencia', estadoPago: 'pagado',
      duracionContrato: 24, mesActual: 8,
      fechaInicioContrato: addMonths(todayStr, -8),
      fechaInicio: addMonths(todayStr, -8),
      fechaVencimiento: addMonths(todayStr, 16),
      proximoVencimientoPago: addDays(todayStr, 12),
      estadoAdmin: 'activo', activo: true,
      expensas: { monto: 15000, estado: 'pendiente', vencimiento: addDays(todayStr, 5) },
      servicios: {
        luz:  { nombre: 'EDET',   estado: 'pagado',    vencimiento: addDays(todayStr, 20) },
        agua: { nombre: 'SAT',    estado: 'pendiente', vencimiento: addDays(todayStr, 3)  },
        gas:  { nombre: 'Gasnor', estado: 'pendiente', vencimiento: addDays(todayStr, 7)  },
      },
    },
    {
      id: 'inq002', adminId: 'adm001', adminNombre: 'Carlos Martínez',
      nombre: 'María', apellido: 'Gómez', email: 'maria.gomez@email.com',
      dni: '30555555', telefono: '+54 9 11 5555-6666', unidad: 'Depto 3B',
      valorAlquiler: 220000, metodoPago: 'Efectivo', estadoPago: 'atrasado',
      duracionContrato: 12, mesActual: 10,
      fechaInicioContrato: addMonths(todayStr, -10),
      fechaInicio: addMonths(todayStr, -10),
      fechaVencimiento: addMonths(todayStr, 2),
      proximoVencimientoPago: addDays(todayStr, -3),
      estadoAdmin: 'activo', activo: true,
      expensas: { monto: 18000, estado: 'atrasado', vencimiento: addDays(todayStr, -2) },
      servicios: {
        luz:  { nombre: 'EDET',   estado: 'atrasado',  vencimiento: addDays(todayStr, -5) },
        agua: { nombre: 'SAT',    estado: 'pagado',    vencimiento: addDays(todayStr, 25) },
        gas:  { nombre: 'Gasnor', estado: 'pendiente', vencimiento: addDays(todayStr, 10) },
      },
    },
    {
      id: 'inq003', adminId: 'adm001', adminNombre: 'Carlos Martínez',
      nombre: 'Roberto', apellido: 'Silva', email: 'roberto.silva@email.com',
      dni: '30666666', telefono: '+54 9 11 6666-7777', unidad: 'Depto 1C',
      valorAlquiler: 150000, metodoPago: 'Débito automático', estadoPago: 'pendiente',
      duracionContrato: 24, mesActual: 3,
      fechaInicioContrato: addMonths(todayStr, -3),
      fechaInicio: addMonths(todayStr, -3),
      fechaVencimiento: addMonths(todayStr, 21),
      proximoVencimientoPago: addDays(todayStr, 1),
      estadoAdmin: 'activo', activo: true,
      expensas: { monto: 12000, estado: 'pendiente', vencimiento: addDays(todayStr, 8) },
      servicios: {
        luz:  { nombre: 'EDET',   estado: 'pendiente', vencimiento: addDays(todayStr, 15) },
        agua: { nombre: 'SAT',    estado: 'pendiente', vencimiento: addDays(todayStr, 18) },
        gas:  { nombre: 'Gasnor', estado: 'pagado',    vencimiento: addDays(todayStr, 30) },
      },
    },
  ];

  const pagos = [
    { id: 'pago001', inquilinoId: 'inq001', inquilinoNombre: 'Juan Pérez', adminId: 'adm001', concepto: 'Alquiler Abril 2025', fecha: addMonths(todayStr, -1), monto: 180000, metodoPago: 'Transferencia', estado: 'acreditado' },
    { id: 'pago002', inquilinoId: 'inq001', inquilinoNombre: 'Juan Pérez', adminId: 'adm001', concepto: 'Alquiler Marzo 2025', fecha: addMonths(todayStr, -2), monto: 160000, metodoPago: 'Transferencia', estado: 'acreditado' },
    { id: 'pago003', inquilinoId: 'inq002', inquilinoNombre: 'María Gómez', adminId: 'adm001', concepto: 'Alquiler Abril 2025', fecha: addMonths(todayStr, -1), monto: 200000, metodoPago: 'Efectivo', estado: 'acreditado' },
    { id: 'pago004', inquilinoId: 'inq003', inquilinoNombre: 'Roberto Silva', adminId: 'adm001', concepto: 'Alquiler Marzo 2025', fecha: addMonths(todayStr, -2), monto: 150000, metodoPago: 'Débito automático', estado: 'acreditado' },
  ];

  const reclamos = [
    { id: 'rec001', inquilinoId: 'inq001', inquilinoNombre: 'Juan Pérez', unidad: 'Depto 2A', adminId: 'adm001', titulo: 'Pérdida de agua en baño', descripcion: 'Hay una pérdida de agua debajo del lavamanos. Necesita revisión urgente.', categoria: 'Plomería', prioridad: 'alta', estado: 'pendiente', fecha: addDays(todayStr, -2), respuesta: '' },
    { id: 'rec002', inquilinoId: 'inq002', inquilinoNombre: 'María Gómez', unidad: 'Depto 3B', adminId: 'adm001', titulo: 'Problema con calefacción', descripcion: 'La calefacción no funciona correctamente. Hace frío en el departamento.', categoria: 'Calefacción', prioridad: 'media', estado: 'en_proceso', fecha: addDays(todayStr, -5), respuesta: 'Se envió técnico para el martes' },
  ];

  const avisos = [
    { id: 'av001', adminId: 'adm001', tipo: 'agua', titulo: 'Corte de agua programado', cuerpo: 'Se informa a todos los inquilinos que el día 15 habrá corte de agua de 9 a 14hs por mantenimiento de red.', fecha: addDays(todayStr, -1), activo: true },
    { id: 'av002', adminId: 'adm001', tipo: 'general', titulo: 'Bienvenidos al sistema RentaAdmin', cuerpo: 'A partir de hoy toda la comunicación del edificio será a través de este sistema. Podés ver avisos, pagar expensas y reportar reclamos.', fecha: addDays(todayStr, -7), activo: true },
  ];

  const notificaciones = [
    { id: 'not001', titulo: 'Sistema iniciado', cuerpo: 'Bienvenido a Domus Alquilia', tipo: 'info', fecha: todayStr, leida: false },
  ];

  const comprobantes = [];
  const actividad = [
    { id: 'act001', adminNombre: 'Carlos Martínez', accion: 'Registró un pago', detalle: 'Juan Pérez — Alquiler', fecha: addDays(todayStr, -1), hora: '10:30', tipo: 'pago' },
  ];

  storageSet(STORAGE_KEYS.USUARIOS,       usuarios);
  storageSet(STORAGE_KEYS.ADMINS,         admins);
  storageSet(STORAGE_KEYS.INQUILINOS,     inquilinos);
  storageSet(STORAGE_KEYS.PAGOS,          pagos);
  storageSet(STORAGE_KEYS.RECLAMOS,       reclamos);
  storageSet(STORAGE_KEYS.AVISOS,         avisos);
  storageSet(STORAGE_KEYS.NOTIFICACIONES, notificaciones);
  storageSet(STORAGE_KEYS.COMPROBANTES,   comprobantes);

  storageSet(STORAGE_KEYS.PROPIEDADES, [
    { id: 'prop001', adminId: 'adm001', nombre: 'Depto 2A', piso: '2', direccion: 'Av. Corrientes 1234', ciudad: 'Buenos Aires', provincia: 'Buenos Aires', observaciones: '', estado: 'ocupada' },
    { id: 'prop002', adminId: 'adm001', nombre: 'Depto 3B', piso: '3', direccion: 'Av. Corrientes 1234', ciudad: 'Buenos Aires', provincia: 'Buenos Aires', observaciones: '', estado: 'ocupada' },
    { id: 'prop003', adminId: 'adm001', nombre: 'Depto 1C', piso: '1', direccion: 'Av. Corrientes 1234', ciudad: 'Buenos Aires', provincia: 'Buenos Aires', observaciones: '', estado: 'ocupada' },
    { id: 'prop004', adminId: 'adm001', nombre: 'Depto 4A', piso: '4', direccion: 'Av. Corrientes 1234', ciudad: 'Buenos Aires', provincia: 'Buenos Aires', observaciones: 'Terraza propia', estado: 'disponible' },
  ]);

  storageSet(STORAGE_KEYS.ACTIVIDAD,      actividad);
  storageSet(STORAGE_KEYS.EXPENSAS,       []);
  storageSet(STORAGE_KEYS.SERVICIOS_PERSONALES, []);
  storageSet(STORAGE_KEYS.RECLAMOS_SA,    []);
}

// ============================================================
// CRUD — ADMINS
// ============================================================

function getAdmins() {
  return storageGet(STORAGE_KEYS.ADMINS, []);
}

function getAdminById(id) {
  return getAdmins().find(a => a.id === id) || null;
}

function createAdmin(data) {
  const admins  = getAdmins();
  const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);

  // Verificar email único
  if (usuarios.find(u => u.email?.toLowerCase() === data.email?.toLowerCase())) {
    return { error: 'El email ya está registrado' };
  }

  const adminId   = 'adm' + Date.now();
  const usuarioId = 'u'   + Date.now();

  const nuevoAdmin = {
    id:                  adminId,
    usuarioId,
    nombre:              data.nombre,
    email:               data.email,
    dni:                 data.dni || '',
    telefono:            data.telefono || '',
    empresa:             data.empresa || '',
    plan:                data.plan || 'basico',
    fechaAlta:           new Date().toISOString().split('T')[0],
    fechaInicioContrato: data.fechaInicioContrato || new Date().toISOString().split('T')[0],
    estado:              'activo',
  };

  const nuevoUsuario = {
    id:      usuarioId,
    email:   data.email,
    dni:     data.dni || '',
    password: data.password,
    rol:     'admin',
    nombre:  data.nombre,
    avatar:  data.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    adminId,
    activo:  true,
  };

  admins.unshift(nuevoAdmin);
  usuarios.push(nuevoUsuario);
  storageSet(STORAGE_KEYS.ADMINS,   admins);
  storageSet(STORAGE_KEYS.USUARIOS, usuarios);
  logActividad('SuperAdmin', 'Creó un admin', nuevoAdmin.nombre);
  return nuevoAdmin;
}

function updateAdmin(id, data) {
  const admins = getAdmins();
  const actualizados = admins.map(a => {
    if (a.id !== id) return a;
    const actualizado = { ...a, ...data };
    // Sincronizar nombre/email en tabla de usuarios
    if (data.nombre || data.email) {
      const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);
      const usuariosActualizados = usuarios.map(u =>
        u.id === a.usuarioId
          ? { ...u, nombre: data.nombre || u.nombre, email: data.email || u.email }
          : u
      );
      storageSet(STORAGE_KEYS.USUARIOS, usuariosActualizados);
    }
    return actualizado;
  });
  storageSet(STORAGE_KEYS.ADMINS, actualizados);
}

function deleteAdmin(id) {
  updateAdmin(id, { estado: 'eliminado' });
}

function toggleAdminEstado(id) {
  const admin = getAdminById(id);
  if (!admin) return;
  const nuevoEstado = admin.estado === 'activo' ? 'suspendido' : 'activo';
  updateAdmin(id, { estado: nuevoEstado });
  // Sincronizar activo/inactivo en tabla de usuarios
  const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);
  storageSet(STORAGE_KEYS.USUARIOS, usuarios.map(u =>
    u.id === admin.usuarioId ? { ...u, activo: nuevoEstado === 'activo' } : u
  ));
  return nuevoEstado;   // ← necesario para el toast en superadmin.js
}

// ============================================================
// CRUD — INQUILINOS
// ============================================================

function getInquilinos() {
  return storageGet(STORAGE_KEYS.INQUILINOS, []);
}

function getInquilinosByAdmin(adminId) {
  return getInquilinos().filter(i =>
    i.adminId === adminId && i.estadoAdmin !== 'oculto' && i.estadoAdmin !== 'desactivado'
  );
}

function getInquilinoById(id) {
  return getInquilinos().find(i => i.id === id) || null;
}

function createInquilino(data) {
  const inquilinos = getInquilinos();
  const usuarios   = storageGet(STORAGE_KEYS.USUARIOS, []);

  if (usuarios.find(u => u.email?.toLowerCase() === data.email?.toLowerCase())) {
    return { error: 'El email ya está registrado' };
  }

  const id        = 'inq' + Date.now();
  const usuarioId = 'u'   + Date.now() + 1;

  const fechaInicio    = data.fechaInicioContrato || new Date().toISOString().split('T')[0];
  const duracion       = data.duracionContrato || 24;
  const fechaVenc      = (() => {
    const d = new Date(fechaInicio);
    d.setMonth(d.getMonth() + duracion);
    return d.toISOString().split('T')[0];
  })();
  const proxVenc = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  })();
  const mesesTransc = (() => {
    const inicio = new Date(fechaInicio);
    const hoy    = new Date();
    return Math.max(0, (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth()));
  })();

  const nuevo = {
    id, adminId: data.adminId, adminNombre: data.adminNombre,
    nombre: data.nombre, apellido: data.apellido,
    email: data.email, dni: data.dni || '',
    telefono: data.telefono || '', unidad: data.unidad,
    valorAlquiler: data.valorAlquiler || 0,
    metodoPago: data.metodoPago || 'Transferencia',
    estadoPago: data.estadoPago || 'pendiente',
    duracionContrato: duracion,
    fechaInicioContrato: fechaInicio, fechaInicio, fechaVencimiento: fechaVenc,
    proximoVencimientoPago: proxVenc,
    mesActual: mesesTransc,
    estadoAdmin: 'activo', activo: true,
    expensas:  { monto: 0, estado: 'pendiente', vencimiento: '' },
    servicios: {
      luz:  { nombre: 'EDET',   estado: 'pendiente', vencimiento: '' },
      agua: { nombre: 'SAT',    estado: 'pendiente', vencimiento: '' },
      gas:  { nombre: 'Gasnor', estado: 'pendiente', vencimiento: '' },
    },
  };

  const nuevoUsuario = {
    id: usuarioId, email: data.email, dni: data.dni || '',
    password: data.password, rol: 'inquilino',
    nombre: `${data.nombre} ${data.apellido}`,
    inquilinoId: id,
    avatar: `${data.nombre[0]}${data.apellido[0]}`.toUpperCase(),
    activo: true,
  };

  inquilinos.unshift(nuevo);
  usuarios.push(nuevoUsuario);
  storageSet(STORAGE_KEYS.INQUILINOS, inquilinos);
  storageSet(STORAGE_KEYS.USUARIOS, usuarios);
  logActividad(data.adminNombre || 'Admin', 'Creó un inquilino', `${data.nombre} ${data.apellido} — ${data.unidad}`);
  return nuevo;
}

function updateInquilino(id, data) {
  const inquilinos   = getInquilinos();
  const actualizados = inquilinos.map(i => i.id === id ? { ...i, ...data } : i);
  storageSet(STORAGE_KEYS.INQUILINOS, actualizados);
}

function deleteInquilino(id)     { updateInquilino(id, { activo: false }); }
function suspenderInquilino(id)  { updateInquilino(id, { estadoAdmin: 'suspendido' }); }
function ocultarInquilino(id)    { updateInquilino(id, { estadoAdmin: 'oculto' }); }
function desactivarInquilino(id) { updateInquilino(id, { estadoAdmin: 'desactivado', activo: false }); }
function reactivarInquilino(id)  { updateInquilino(id, { estadoAdmin: 'activo', activo: true }); }

// ============================================================
// CRUD — PAGOS
// ============================================================

function getPagos()                        { return storageGet(STORAGE_KEYS.PAGOS, []); }
function getPagosByInquilino(inquilinoId)   { return getPagos().filter(p => p.inquilinoId === inquilinoId); }
function getPagosByAdmin(adminId)           { return getPagos().filter(p => p.adminId === adminId); }

function createPago(data) {
  const pagos = getPagos();
  const nuevo = { id: 'pago' + Date.now(), ...data };
  pagos.unshift(nuevo);
  storageSet(STORAGE_KEYS.PAGOS, pagos);
  logActividad(data.adminNombre || 'Admin', 'Registró un pago', `${data.inquilinoNombre} — ${data.concepto}`);
  return nuevo;
}

// ============================================================
// CRUD — RECLAMOS (inquilino → admin)
// ============================================================

function getReclamos()                       { return storageGet(STORAGE_KEYS.RECLAMOS, []); }
function getReclamosByInquilino(inquilinoId) { return getReclamos().filter(r => r.inquilinoId === inquilinoId); }
function getReclamosByAdmin(adminId)         { return getReclamos().filter(r => r.adminId === adminId); }

function createReclamo(data) {
  const reclamos = getReclamos();
  const nuevo = {
    id: 'rec' + Date.now(), estado: 'pendiente',
    fecha: new Date().toISOString().split('T')[0], respuesta: '', ...data
  };
  reclamos.unshift(nuevo);
  storageSet(STORAGE_KEYS.RECLAMOS, reclamos);
  addNotificacion({ titulo: 'Nuevo reclamo', cuerpo: `${data.inquilinoNombre} reportó: ${data.titulo}`, tipo: 'warning' });
  return nuevo;
}

function updateReclamo(id, data) {
  storageSet(STORAGE_KEYS.RECLAMOS, getReclamos().map(r => r.id === id ? { ...r, ...data } : r));
}

// ============================================================
// CRUD — RECLAMOS SA (admin → superadmin)
// ============================================================

function getReclamosSA()                  { return storageGet(STORAGE_KEYS.RECLAMOS_SA, []); }
function getReclamosSAByAdmin(adminId)    { return getReclamosSA().filter(r => r.adminId === adminId); }

function createReclamoSA(data) {
  const reclamos = getReclamosSA();
  const nuevo = {
    id: 'rsa' + Date.now(), estado: 'pendiente',
    fecha: new Date().toISOString().split('T')[0], respuesta: '', ...data
  };
  reclamos.unshift(nuevo);
  storageSet(STORAGE_KEYS.RECLAMOS_SA, reclamos);
  return nuevo;
}

function updateReclamoSA(id, data) {
  storageSet(STORAGE_KEYS.RECLAMOS_SA, getReclamosSA().map(r => r.id === id ? { ...r, ...data } : r));
}

// ============================================================
// CRUD — AVISOS
// ============================================================

function getAvisos()               { return storageGet(STORAGE_KEYS.AVISOS, []).filter(a => a.activo); }
function getAvisosByAdmin(adminId) { return getAvisos().filter(a => a.adminId === adminId); }

function createAviso(data) {
  const avisos = storageGet(STORAGE_KEYS.AVISOS, []);
  const nuevo  = { id: 'av' + Date.now(), fecha: new Date().toISOString().split('T')[0], activo: true, ...data };
  avisos.unshift(nuevo);
  storageSet(STORAGE_KEYS.AVISOS, avisos);
  return nuevo;
}

function deleteAviso(id) {
  storageSet(STORAGE_KEYS.AVISOS,
    storageGet(STORAGE_KEYS.AVISOS, []).map(a => a.id === id ? { ...a, activo: false } : a)
  );
}

// ============================================================
// CRUD — NOTIFICACIONES
// ============================================================

function getNotificaciones()   { return storageGet(STORAGE_KEYS.NOTIFICACIONES, []); }
function countNotifNoLeidas()  { return getNotificaciones().filter(n => !n.leida).length; }
function marcarTodasLeidas()   { storageSet(STORAGE_KEYS.NOTIFICACIONES, getNotificaciones().map(n => ({ ...n, leida: true }))); }

function addNotificacion(data) {
  const notifs = getNotificaciones();
  const nueva  = { id: 'not' + Date.now(), fecha: new Date().toISOString().split('T')[0], leida: false, ...data };
  notifs.unshift(nueva);
  storageSet(STORAGE_KEYS.NOTIFICACIONES, notifs);
  return nueva;
}

// ============================================================
// CRUD — COMPROBANTES
// ============================================================

function getComprobantes()                      { return storageGet(STORAGE_KEYS.COMPROBANTES, []); }
function getComprobantesByInquilino(inquilinoId){ return getComprobantes().filter(c => c.inquilinoId === inquilinoId); }
function getComprobantesByAdmin(adminId)        { return getComprobantes().filter(c => c.adminId === adminId); }

function createComprobante(data) {
  const comps = getComprobantes();
  const nuevo = { id: 'comp' + Date.now(), fecha: new Date().toISOString().split('T')[0], estado: 'pendiente', ...data };
  comps.unshift(nuevo);
  storageSet(STORAGE_KEYS.COMPROBANTES, comps);
  addNotificacion({ titulo: 'Nuevo comprobante', cuerpo: `${data.inquilinoNombre || 'Un inquilino'} adjuntó un comprobante.`, tipo: 'success' });
  return nuevo;
}

function updateComprobante(id, data) {
  storageSet(STORAGE_KEYS.COMPROBANTES, getComprobantes().map(c => c.id === id ? { ...c, ...data } : c));
}

// ============================================================
// CRUD — EXPENSAS (admin crea, inquilino ve/paga)
// ============================================================

function getExpensas()                        { return storageGet(STORAGE_KEYS.EXPENSAS, []); }
function getExpensasByAdmin(adminId)          { return getExpensas().filter(e => e.adminId === adminId); }
function getExpensasByInquilino(inquilinoId)  { return getExpensas().filter(e => e.inquilinoId === inquilinoId); }

function createExpensa(data) {
  const expensas = getExpensas();
  const nueva = {
    id: 'exp' + Date.now(),
    fecha: new Date().toISOString().split('T')[0],
    estadoInquilino: 'pendiente',
    tipo: 'ordinaria',
    ...data,
  };
  expensas.unshift(nueva);
  storageSet(STORAGE_KEYS.EXPENSAS, expensas);
  addNotificacion({ titulo: 'Nueva expensa', cuerpo: `Se cargó una expensa para ${data.inquilinoNombre || 'un inquilino'}.`, tipo: 'info' });
  return nueva;
}

function updateExpensa(id, data) {
  storageSet(STORAGE_KEYS.EXPENSAS, getExpensas().map(e => e.id === id ? { ...e, ...data } : e));
}

function deleteExpensa(id) {
  storageSet(STORAGE_KEYS.EXPENSAS, getExpensas().filter(e => e.id !== id));
}

// ============================================================
// CRUD — SERVICIOS PERSONALES (solo inquilino)
// ============================================================

function getServiciosPersonales()                    { return storageGet(STORAGE_KEYS.SERVICIOS_PERSONALES, []); }
function getServiciosByInquilino(inquilinoId)        { return getServiciosPersonales().filter(s => s.inquilinoId === inquilinoId); }

function createServicioPersonal(data) {
  const servicios = getServiciosPersonales();
  const nuevo = {
    id: 'srv' + Date.now(),
    fecha: new Date().toISOString().split('T')[0],
    estado: 'pendiente',
    ...data,
  };
  servicios.unshift(nuevo);
  storageSet(STORAGE_KEYS.SERVICIOS_PERSONALES, servicios);
  return nuevo;
}

function updateServicioPersonal(id, data) {
  storageSet(STORAGE_KEYS.SERVICIOS_PERSONALES,
    getServiciosPersonales().map(s => s.id === id ? { ...s, ...data } : s)
  );
}

function deleteServicioPersonal(id) {
  storageSet(STORAGE_KEYS.SERVICIOS_PERSONALES,
    getServiciosPersonales().filter(s => s.id !== id)
  );
}

// ============================================================
// CRUD — PROPIEDADES
// ============================================================

function getPropiedades() {
  return storageGet(STORAGE_KEYS.PROPIEDADES, []);
}

function getPropiedadesByAdmin(adminId) {
  return getPropiedades().filter(p => p.adminId === adminId);
}

function getPropiedadById(id) {
  return getPropiedades().find(p => p.id === id) || null;
}

/**
 * Normaliza nombre para comparación de duplicados (minúsculas, sin espacios extra).
 */
function _normalizarNombrePropiedad(nombre) {
  return nombre.trim().toLowerCase().replace(/\s+/g, ' ');
}

function createPropiedad(data) {
  const propiedades = getPropiedades();
  const nombreNorm  = _normalizarNombrePropiedad(data.nombre || '');

  // Verificar duplicado por nombre + adminId
  const duplicado = propiedades.find(p =>
    p.adminId === data.adminId &&
    _normalizarNombrePropiedad(p.nombre) === nombreNorm
  );
  if (duplicado) {
    return { error: `La propiedad "${duplicado.nombre}" ya existe.` };
  }

  const nueva = {
    id:           'prop' + Date.now(),
    adminId:      data.adminId,
    nombre:       data.nombre.trim(),
    piso:         data.piso || '',
    direccion:    data.direccion || '',
    ciudad:       data.ciudad || '',
    provincia:    data.provincia || '',
    observaciones: data.observaciones || '',
    estado:       data.estado || 'disponible',
  };
  propiedades.unshift(nueva);
  storageSet(STORAGE_KEYS.PROPIEDADES, propiedades);
  logActividad(data.adminNombre || 'Admin', 'Creó una propiedad', nueva.nombre);
  return nueva;
}

function updatePropiedad(id, data) {
  const propiedades = getPropiedades();
  const prop        = propiedades.find(p => p.id === id);
  if (!prop) return { error: 'Propiedad no encontrada' };

  // Si cambia el nombre, verificar duplicado
  if (data.nombre) {
    const nombreNorm = _normalizarNombrePropiedad(data.nombre);
    const duplicado  = propiedades.find(p =>
      p.id !== id &&
      p.adminId === prop.adminId &&
      _normalizarNombrePropiedad(p.nombre) === nombreNorm
    );
    if (duplicado) {
      return { error: `Ya existe una propiedad con ese nombre: "${duplicado.nombre}".` };
    }
  }

  const actualizadas = propiedades.map(p => p.id === id ? { ...p, ...data } : p);
  storageSet(STORAGE_KEYS.PROPIEDADES, actualizadas);
  return actualizadas.find(p => p.id === id);
}

function deletePropiedad(id) {
  // Solo eliminar si está disponible
  const prop = getPropiedadById(id);
  if (!prop) return { error: 'Propiedad no encontrada' };
  if (prop.estado !== 'disponible') {
    return { error: `No se puede eliminar: la propiedad está ${prop.estado}.` };
  }
  storageSet(STORAGE_KEYS.PROPIEDADES, getPropiedades().filter(p => p.id !== id));
  return { ok: true };
}

/**
 * Ocupa una propiedad al crear/editar inquilino.
 * estado: 'ocupada' | 'reservada'
 */
function ocuparPropiedad(propiedadId, estado = 'ocupada') {
  updatePropiedad(propiedadId, { estado });
}

/**
 * Libera una propiedad (vuelve a 'disponible').
 */
function liberarPropiedad(propiedadId) {
  updatePropiedad(propiedadId, { estado: 'disponible' });
}

// ============================================================
// LOG DE ACTIVIDAD (SuperAdmin dashboard)
// ============================================================

function logActividad(adminNombre, accion, detalle = '') {
  const actividad = storageGet(STORAGE_KEYS.ACTIVIDAD, []);
  actividad.unshift({
    id: 'act' + Date.now(), adminNombre, accion, detalle,
    fecha: new Date().toISOString().split('T')[0],
    hora:  new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    tipo:  inferirTipoActividad(accion),
  });
  storageSet(STORAGE_KEYS.ACTIVIDAD, actividad.slice(0, 50));
}

function inferirTipoActividad(accion) {
  if (accion.includes('pago'))      return 'pago';
  if (accion.includes('inquilino')) return 'inquilino';
  if (accion.includes('reclamo'))   return 'reclamo';
  if (accion.includes('aviso'))     return 'aviso';
  if (accion.includes('admin'))     return 'admin';
  return 'general';
}

function getActividad() { return storageGet(STORAGE_KEYS.ACTIVIDAD, []); }

// ============================================================
// RESTABLECIMIENTO DE CONTRASEÑAS
// ============================================================

function resetPasswordAdmin(adminId, newPass) {
  const admin = getAdminById(adminId);
  if (!admin) return false;
  const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);
  storageSet(STORAGE_KEYS.USUARIOS, usuarios.map(u =>
    u.id === admin.usuarioId ? { ...u, password: newPass } : u
  ));
  logActividad('SuperAdmin', 'Restableció contraseña', `Admin: ${admin.nombre}`);
  return true;
}

function resetPasswordInquilino(inquilinoId, newPass) {
  const inq = getInquilinoById(inquilinoId);
  if (!inq) return false;
  const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);
  storageSet(STORAGE_KEYS.USUARIOS, usuarios.map(u =>
    u.email === inq.email ? { ...u, password: newPass } : u
  ));
  return true;
}

// ============================================================
// SESIÓN
// ============================================================

function setSession(usuario) { storageSet(STORAGE_KEYS.SESION_ACTUAL, usuario); }
function getSession()        { return storageGet(STORAGE_KEYS.SESION_ACTUAL, null); }
function clearSession()      { storageRemove(STORAGE_KEYS.SESION_ACTUAL); }
function isLoggedIn()        { return getSession() !== null; }

// ============================================================
// AUTENTICACIÓN
// ============================================================

function autenticar(emailODni, password) {
  const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);
  const esDni    = /^\d{6,8}$/.test(emailODni);

  const user = usuarios.find(u => {
    const matchEmail = u.email && u.email.toLowerCase() === emailODni.toLowerCase();
    const matchDni   = esDni && u.dni && u.dni === emailODni;
    return (matchEmail || matchDni) && u.password === password && u.activo !== false;
  });

  if (!user) return null;

  if (user.rol === 'admin' && user.adminId) {
    const admin = getAdminById(user.adminId);
    if (admin && admin.estado === 'suspendido') return { suspendido: true };
  }

  return user;
}

// ============================================================
// USUARIOS DESACTIVADOS
// ============================================================

function getUsuariosDesactivados() { return storageGet(STORAGE_KEYS.USUARIOS_DESACTIVADOS, []); }

function moverADesactivados(usuarioData) {
  const desactivados = getUsuariosDesactivados();
  if (!desactivados.find(u => u.id === usuarioData.id)) {
    desactivados.unshift({
      ...usuarioData,
      fechaDesactivacion: new Date().toISOString().split('T')[0],
      motivo: usuarioData.motivo || '',
    });
    storageSet(STORAGE_KEYS.USUARIOS_DESACTIVADOS, desactivados);
  }
}

function quitarDeDesactivados(id) {
  storageSet(STORAGE_KEYS.USUARIOS_DESACTIVADOS,
    getUsuariosDesactivados().filter(u => u.id !== id)
  );
}

function restaurarAdminDesactivado(usuarioDesactivadoId) {
  const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);
  storageSet(STORAGE_KEYS.USUARIOS, usuarios.map(u =>
    u.id === usuarioDesactivadoId ? { ...u, activo: true } : u
  ));
  const admins = getAdmins();
  storageSet(STORAGE_KEYS.ADMINS, admins.map(a =>
    a.usuarioId === usuarioDesactivadoId ? { ...a, estado: 'activo' } : a
  ));
  quitarDeDesactivados(usuarioDesactivadoId);
  logActividad('SuperAdmin', 'Restauró usuario', `ID: ${usuarioDesactivadoId}`);
}

function restaurarInquilinoDesactivado(usuarioDesactivadoId) {
  const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);
  storageSet(STORAGE_KEYS.USUARIOS, usuarios.map(u =>
    u.id === usuarioDesactivadoId ? { ...u, activo: true } : u
  ));
  const usuario = usuarios.find(u => u.id === usuarioDesactivadoId);
  if (usuario) {
    storageSet(STORAGE_KEYS.INQUILINOS, getInquilinos().map(i =>
      i.email === usuario.email ? { ...i, activo: true, estadoAdmin: 'activo' } : i
    ));
  }
  quitarDeDesactivados(usuarioDesactivadoId);
  logActividad('Admin', 'Restauró inquilino', `ID: ${usuarioDesactivadoId}`);
}


// ============================================================
// MIGRACIÓN: inq.servicios → SERVICIOS_PERSONALES
// ============================================================
function migrarServiciosLegacy() {
  const inquilinos = getInquilinos();
  const existentes = getServiciosPersonales();
  const nuevos     = [];
  const TIPO_MAP   = { luz: 'Luz', agua: 'Agua', gas: 'Gas' };

  inquilinos.forEach(inq => {
    if (!inq.servicios) return;
    ['luz', 'agua', 'gas'].forEach(tipo => {
      const srv = inq.servicios[tipo];
      if (!srv) return;
      const yaMigrado = existentes.some(e => e.inquilinoId === inq.id && e.tipo === tipo)
                     || nuevos.some(n => n.inquilinoId === inq.id && n.tipo === tipo);
      if (yaMigrado) return;
      nuevos.push({
        id: 'srv_m_' + inq.id + '_' + tipo,
        inquilinoId: inq.id,
        tipo,
        nombre:      srv.nombre || TIPO_MAP[tipo] || tipo,
        monto:       0,
        vencimiento: srv.vencimiento || '',
        estado:      srv.estado || 'pendiente',
        comprobante: null,
        fecha:       new Date().toISOString().split('T')[0],
        migrado:     true,
      });
    });
  });

  if (nuevos.length > 0) {
    storageSet(STORAGE_KEYS.SERVICIOS_PERSONALES, [...existentes, ...nuevos]);
    console.log('[Storage] Migración legacy:', nuevos.length, 'servicios importados.');
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================

const SEED_VERSION = 'v5';
if (storageGet('renta_seed_version') !== SEED_VERSION) {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('renta_seed_version');
}
initStorage();
storageSet('renta_seed_version', SEED_VERSION);
migrarServiciosLegacy();
console.log('[Storage v5] Módulo listo. Roles + expensas + servicios + reclamos_SA + contratos + propiedades.');