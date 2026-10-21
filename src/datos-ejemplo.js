const crypto = require('crypto');

/** Suma (o resta) días a una fecha AAAA-MM-DD. */
function dia(base, dias) {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Nombres de proveedores ficticios; NIT de ejemplo.
const PROVEEDORES = [
  { nombre: 'Droguería Oriente S.R.L.', nit: '3012457018', telefono: '3-3456789', diasCredito: 30 },
  { nombre: 'Distribuidora Farmacéutica Chiquitana', nit: '2894561012', telefono: '3-3521478', diasCredito: 45 },
  { nombre: 'Laboratorio Andino Genéricos', nit: '1023658029', telefono: '2-2457810', diasCredito: 0 },
];

// precioVenta en Bs, por unidad (tableta, frasco o sobre)
const PRODUCTOS = [
  { codigo: 'PAR500', nombre: 'Paracetamol 500 mg (tableta)', precioVenta: 0.5, stockMinimo: 200 },
  { codigo: 'IBU400', nombre: 'Ibuprofeno 400 mg (tableta)', precioVenta: 1, stockMinimo: 150 },
  { codigo: 'AMX500', nombre: 'Amoxicilina 500 mg (cápsula)', precioVenta: 1.5, stockMinimo: 100 },
  { codigo: 'LOR10', nombre: 'Loratadina 10 mg (tableta)', precioVenta: 1, stockMinimo: 60 },
  { codigo: 'OME20', nombre: 'Omeprazol 20 mg (cápsula)', precioVenta: 1.2, stockMinimo: 80 },
  { codigo: 'SRO-SOB', nombre: 'Sales de rehidratación oral (sobre)', precioVenta: 3, stockMinimo: 40 },
  { codigo: 'JAR-TOS', nombre: 'Jarabe para la tos 120 ml', precioVenta: 28, stockMinimo: 10 },
  { codigo: 'ALC-250', nombre: 'Alcohol medicinal 70% 250 ml', precioVenta: 12, stockMinimo: 15 },
  { codigo: 'REP-50', nombre: 'Repelente de insectos 50 ml', precioVenta: 35, stockMinimo: 12 },
  { codigo: 'MET850', nombre: 'Metformina 850 mg (tableta)', precioVenta: 0.8, stockMinimo: 120 },
];

/**
 * Carga datos de ejemplo de una farmacia de Santa Cruz de la Sierra, con fechas
 * relativas a `hoy` para que siempre haya alertas y reportes que mostrar:
 * un lote vencido, lotes por vencer, un producto bajo el mínimo, compras al
 * contado y a crédito, y una semana de ventas de dos cajeros.
 * Devuelve las credenciales creadas (para mostrarlas una sola vez).
 */
function cargarDatosDeEjemplo(servicios, { hoy = new Date().toISOString().slice(0, 10), passwords = {} } = {}) {
  const { usuarios, inventario, proveedores, compras, ventas } = servicios;
  if (inventario.listar().length > 0 || usuarios.cantidad() > 0) {
    throw new Error('Los datos de ejemplo solo se cargan en una farmacia vacía');
  }

  const clave = (u) => passwords[u] || crypto.randomBytes(9).toString('base64url');
  const credenciales = [
    { usuario: 'admin', nombre: 'Rosa Gutiérrez (dueña)', rol: 'admin', password: clave('admin') },
    { usuario: 'luis', nombre: 'Luis Vaca', rol: 'cajero', password: clave('luis') },
    { usuario: 'carla', nombre: 'Carla Suárez', rol: 'cajero', password: clave('carla') },
  ];
  const [, luis, carla] = credenciales.map((c) => usuarios.crear(c));

  const [oriente, chiquitana, andino] = PROVEEDORES.map((p) => proveedores.crear(p));
  const p = {};
  for (const datos of PRODUCTOS) p[datos.codigo] = inventario.crearProducto(datos);

  const lote = (codigo, numero, vencimiento, cantidad, costoUnitario) => ({
    productoId: p[codigo].id,
    lote: numero,
    vencimiento,
    cantidad,
    costoUnitario,
  });

  // Compras: una antigua (con un lote que ya venció), otras recientes a crédito y al contado
  compras.registrar({
    proveedorId: oriente.id,
    numeroFactura: '001245',
    fecha: dia(hoy, -75),
    condicion: 'credito',
    items: [
      lote('SRO-SOB', 'SRO-2309', dia(hoy, -5), 30, 1.6),
      lote('JAR-TOS', 'JT-4410', dia(hoy, 20), 18, 16.5),
      lote('LOR10', 'LO-1187', dia(hoy, 25), 80, 0.45),
    ],
  });
  compras.registrar({
    proveedorId: oriente.id,
    numeroFactura: '001398',
    fecha: dia(hoy, -20),
    condicion: 'credito',
    items: [
      lote('PAR500', 'PA-7781', dia(hoy, 540), 1000, 0.18),
      lote('IBU400', 'IB-3320', dia(hoy, 480), 600, 0.4),
      lote('AMX500', 'AX-5512', dia(hoy, 12), 60, 0.7),
      lote('AMX500', 'AX-6020', dia(hoy, 400), 300, 0.75),
    ],
  });
  compras.registrar({
    proveedorId: chiquitana.id,
    numeroFactura: 'B-20871',
    fecha: dia(hoy, -10),
    condicion: 'credito',
    items: [
      lote('OME20', 'OM-0921', dia(hoy, 365), 400, 0.5),
      lote('MET850', 'MF-1450', dia(hoy, 300), 150, 0.3),
      lote('REP-50', 'RP-0077', dia(hoy, 700), 24, 21),
      lote('SRO-SOB', 'SRO-2405', dia(hoy, 330), 30, 1.7),
    ],
  });
  compras.registrar({
    proveedorId: andino.id,
    numeroFactura: '7741',
    fecha: dia(hoy, -8),
    condicion: 'contado',
    items: [lote('ALC-250', 'AL-2210', dia(hoy, 900), 48, 6.8)],
  });
  // Abono parcial a la factura más antigua
  compras.abonar(1, { monto: 300, fecha: dia(hoy, -30) });

  // Una semana de ventas típicas en mostrador
  const cajeros = [luis, carla];
  const canastas = [
    [['PAR500', 30], ['SRO-SOB', 2]],
    [['IBU400', 10], ['ALC-250', 1]],
    [['AMX500', 21]],
    [['JAR-TOS', 1], ['LOR10', 10]],
    [['OME20', 14], ['MET850', 10]],
    [['REP-50', 2], ['PAR500', 10]],
    [['IBU400', 6], ['SRO-SOB', 3], ['ALC-250', 1]],
  ];
  const metodos = ['efectivo', 'qr', 'efectivo', 'tarjeta', 'qr', 'efectivo', 'efectivo'];
  for (let d = 7; d >= 1; d--) {
    for (let i = 0; i < canastas.length; i++) {
      if ((d + i) % 3 === 0) continue; // no todos los productos se venden todos los días
      ventas.registrar(
        {
          items: canastas[i].map(([codigo, cantidad]) => ({ productoId: p[codigo].id, cantidad })),
          metodoPago: metodos[i],
          fecha: dia(hoy, -d),
        },
        cajeros[(d + i) % 2],
      );
    }
  }

  return {
    credenciales: credenciales.map(({ usuario, rol, password }) => ({ usuario, rol, password })),
    resumen: {
      productos: inventario.listar().length,
      proveedores: proveedores.listar().length,
      compras: compras.listar().length,
      ventas: ventas.listar().length,
    },
  };
}

module.exports = { cargarDatosDeEjemplo, PRODUCTOS, PROVEEDORES };
