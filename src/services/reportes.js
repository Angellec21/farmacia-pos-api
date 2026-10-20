const { redondear } = require('./inventario');

const ANCHO = 32; // caracteres por línea en impresora térmica de 58 mm

function bs(n) {
  return `Bs ${n.toFixed(2)}`;
}

function linea(izq, der) {
  const espacio = Math.max(ANCHO - izq.length - der.length, 1);
  return izq + ' '.repeat(espacio) + der;
}

function centrar(texto) {
  const t = texto.slice(0, ANCHO);
  return ' '.repeat(Math.floor((ANCHO - t.length) / 2)) + t;
}

/** Ticket en texto plano listo para una impresora térmica de 58 mm. */
function ticketTexto(venta, negocio = {}) {
  const { nombre = 'FARMACIA', direccion = 'Santa Cruz de la Sierra', nit = '' } = negocio;
  const sep = '-'.repeat(ANCHO);
  const out = [centrar(nombre), centrar(direccion)];
  if (nit) out.push(centrar(`NIT ${nit}`));
  out.push(sep, `Venta Nro: ${venta.numero}`, `Fecha: ${venta.fecha}`);
  if (venta.cajero) out.push(`Cajero: ${venta.cajero.nombre}`.slice(0, ANCHO));
  out.push(`Cliente: ${venta.cliente}`.slice(0, ANCHO), `NIT/CI: ${venta.nit}`, sep);
  for (const it of venta.items) {
    out.push(it.producto.slice(0, ANCHO));
    out.push(linea(`  ${it.cantidad} x ${it.precioUnitario.toFixed(2)}`, bs(it.subtotal)));
  }
  out.push(sep, linea('TOTAL', bs(venta.total)), linea('Pago', venta.metodoPago.toUpperCase()));
  if (venta.cambio !== null) {
    out.push(linea('Recibido', bs(venta.montoRecibido)), linea('Cambio', bs(venta.cambio)));
  }
  out.push(sep, centrar('Gracias por su compra'), centrar('Consulte a su farmacéutico'));
  return out.join('\n') + '\n';
}

/** Cierre de caja del día: totales por método de pago, margen y unidades. */
function cierreDiario(ventas, fecha) {
  const delDia = ventas.filter((v) => v.fecha === fecha);
  const porMetodo = {};
  for (const v of delDia) {
    const m = (porMetodo[v.metodoPago] ||= { ventas: 0, totalBs: 0 });
    m.ventas += 1;
    m.totalBs = redondear(m.totalBs + v.total);
  }
  const totalBs = redondear(delDia.reduce((s, v) => s + v.total, 0));
  const costoBs = redondear(delDia.reduce((s, v) => s + v.costo, 0));
  const margenBs = redondear(totalBs - costoBs);
  return {
    fecha,
    cantidadVentas: delDia.length,
    unidadesVendidas: delDia.reduce((s, v) => s + v.items.reduce((a, i) => a + i.cantidad, 0), 0),
    totalBs,
    costoBs,
    margenBs,
    margenPorcentaje: totalBs > 0 ? redondear((margenBs / totalBs) * 100) : 0,
    ticketPromedioBs: delDia.length > 0 ? redondear(totalBs / delDia.length) : 0,
    porMetodo,
  };
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Filtra ventas por rango de fechas inclusivo (AAAA-MM-DD); sin límites = todo. */
function enPeriodo(ventas, { desde, hasta } = {}) {
  return ventas.filter((v) => (!desde || v.fecha >= desde) && (!hasta || v.fecha <= hasta));
}

function porcentaje(parte, total) {
  return total > 0 ? redondear((parte / total) * 100) : 0;
}

/** Acumula unidades, ingresos y costo por producto en el periodo. */
function acumularPorProducto(ventas) {
  const mapa = new Map();
  for (const v of ventas) {
    for (const it of v.items) {
      const a = mapa.get(it.productoId) || {
        productoId: it.productoId,
        producto: it.producto,
        codigo: it.codigo,
        unidades: 0,
        ingresosBs: 0,
        costoBs: 0,
      };
      a.unidades += it.cantidad;
      a.ingresosBs = redondear(a.ingresosBs + it.subtotal);
      a.costoBs = redondear(a.costoBs + (it.costo || 0));
      mapa.set(it.productoId, a);
    }
  }
  return [...mapa.values()];
}

/**
 * Ranking de productos más vendidos. `orden` = 'unidades' (por defecto) o
 * 'ingresos'. Incluye la participación de cada producto en el total del periodo.
 */
function masVendidos(ventas, { desde, hasta, limite = 10, orden = 'unidades' } = {}) {
  const filas = acumularPorProducto(enPeriodo(ventas, { desde, hasta }));
  const totalBs = redondear(filas.reduce((s, f) => s + f.ingresosBs, 0));
  const clave = orden === 'ingresos' ? 'ingresosBs' : 'unidades';
  return filas
    .sort((a, b) => b[clave] - a[clave] || a.producto.localeCompare(b.producto))
    .slice(0, limite)
    .map(({ costoBs, ...f }, i) => ({ puesto: i + 1, ...f, participacion: porcentaje(f.ingresosBs, totalBs) }));
}

/**
 * Margen bruto por producto (ingresos - costo real de los lotes vendidos),
 * de menor a mayor margen %: lo primero que ve el dueño es lo que menos deja.
 */
function margenPorProducto(ventas, { desde, hasta } = {}) {
  return acumularPorProducto(enPeriodo(ventas, { desde, hasta }))
    .map((f) => {
      const margenBs = redondear(f.ingresosBs - f.costoBs);
      return { ...f, margenBs, margenPorcentaje: porcentaje(margenBs, f.ingresosBs) };
    })
    .sort((a, b) => a.margenPorcentaje - b.margenPorcentaje || a.producto.localeCompare(b.producto));
}

/** Desempeño por cajero: ventas, total, ticket promedio y métodos de pago. */
function ventasPorCajero(ventas, { desde, hasta } = {}) {
  const mapa = new Map();
  for (const v of enPeriodo(ventas, { desde, hasta })) {
    const id = v.cajero ? v.cajero.id : null;
    const c = mapa.get(id) || {
      cajeroId: id,
      cajero: v.cajero ? v.cajero.nombre : 'Sin cajero',
      ventas: 0,
      unidades: 0,
      totalBs: 0,
      porMetodo: {},
    };
    c.ventas += 1;
    c.unidades += v.items.reduce((s, i) => s + i.cantidad, 0);
    c.totalBs = redondear(c.totalBs + v.total);
    c.porMetodo[v.metodoPago] = redondear((c.porMetodo[v.metodoPago] || 0) + v.total);
    mapa.set(id, c);
  }
  return [...mapa.values()]
    .map((c) => ({ ...c, ticketPromedioBs: redondear(c.totalBs / c.ventas) }))
    .sort((a, b) => b.totalBs - a.totalBs);
}

/** Valida y normaliza el periodo recibido por query string. */
function validarPeriodo({ desde, hasta } = {}) {
  for (const [nombre, valor] of [['desde', desde], ['hasta', hasta]]) {
    if (valor !== undefined && (!FECHA_RE.test(valor) || Number.isNaN(Date.parse(valor)))) {
      return `${nombre} debe tener formato AAAA-MM-DD`;
    }
  }
  if (desde && hasta && desde > hasta) return 'desde no puede ser posterior a hasta';
  return null;
}

module.exports = {
  ticketTexto,
  cierreDiario,
  masVendidos,
  margenPorProducto,
  ventasPorCajero,
  validarPeriodo,
  ANCHO,
};
