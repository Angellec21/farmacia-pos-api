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

module.exports = { ticketTexto, cierreDiario, ANCHO };
