const { HttpError } = require('../errors');
const { redondear } = require('./inventario');

const METODOS_PAGO = ['efectivo', 'qr', 'tarjeta'];

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Servicio de ventas. Cada venta descuenta stock por FEFO y guarda
 * qué lotes se usaron (trazabilidad exigida para medicamentos).
 */
function crearVentas(inventario) {
  const ventas = [];
  let siguienteNumero = 1;

  function validarItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpError(400, 'items debe ser una lista con al menos un producto');
    }
    for (const it of items) {
      if (!it || it.productoId === undefined) throw new HttpError(400, 'cada item necesita productoId');
      if (!Number.isInteger(it.cantidad) || it.cantidad <= 0) {
        throw new HttpError(400, 'cantidad debe ser un entero mayor a 0');
      }
    }
  }

  /**
   * Registra una venta "todo o nada": si un solo producto no tiene stock
   * vigente suficiente, no se descuenta nada. `cajero` es el usuario de la sesión
   * (nunca se toma del cuerpo de la petición).
   */
  function registrar(
    { items, metodoPago = 'efectivo', cliente = null, nit = null, fecha = hoyISO(), montoRecibido },
    cajero = null,
  ) {
    validarItems(items);
    if (!METODOS_PAGO.includes(metodoPago)) {
      throw new HttpError(400, `metodoPago debe ser uno de: ${METODOS_PAGO.join(', ')}`);
    }

    // 1) Verificar stock de todos los productos (agrupando repetidos) antes de tocar nada
    const pedidos = new Map();
    for (const it of items) {
      const id = Number(it.productoId);
      pedidos.set(id, (pedidos.get(id) || 0) + it.cantidad);
    }
    for (const [id, cantidad] of pedidos) {
      const p = inventario.obtener(id);
      const vigente = inventario.stockVigente(id, fecha);
      if (vigente < cantidad) {
        throw new HttpError(409, `Stock vigente insuficiente de ${p.nombre}: hay ${vigente}, se piden ${cantidad}`);
      }
    }

    // 2) Validar el pago antes de descontar stock
    let total = 0;
    for (const [id, cantidad] of pedidos) total += inventario.obtener(id).precioVenta * cantidad;
    total = redondear(total);
    let cambio = null;
    if (montoRecibido !== undefined && montoRecibido !== null) {
      if (metodoPago !== 'efectivo') throw new HttpError(400, 'montoRecibido solo aplica a pagos en efectivo');
      if (typeof montoRecibido !== 'number' || montoRecibido < total) {
        throw new HttpError(400, `montoRecibido (${montoRecibido}) es menor al total Bs ${total.toFixed(2)}`);
      }
      cambio = redondear(montoRecibido - total);
    }

    // 3) Descontar por FEFO y armar el detalle
    const detalle = [];
    for (const [id, cantidad] of pedidos) {
      const { producto, usados, costoTotal } = inventario.descontar(id, cantidad, fecha);
      detalle.push({
        productoId: id,
        producto: producto.nombre,
        codigo: producto.codigo,
        cantidad,
        precioUnitario: producto.precioVenta,
        subtotal: redondear(producto.precioVenta * cantidad),
        costo: costoTotal,
        lotes: usados.map((u) => ({ lote: u.lote, vencimiento: u.vencimiento, cantidad: u.cantidad })),
      });
    }
    const costo = redondear(detalle.reduce((s, d) => s + d.costo, 0));

    const venta = {
      numero: siguienteNumero++,
      fecha,
      cliente: cliente || 'Sin nombre',
      nit: nit || '0',
      metodoPago,
      cajero: cajero ? { id: cajero.id, nombre: cajero.nombre } : null,
      items: detalle,
      total,
      costo,
      margen: redondear(total - costo),
      montoRecibido: montoRecibido ?? null,
      cambio,
    };
    ventas.push(venta);
    return venta;
  }

  function listar({ fecha, cajeroId } = {}) {
    return ventas.filter(
      (v) => (!fecha || v.fecha === fecha) && (cajeroId === undefined || (v.cajero && v.cajero.id === cajeroId)),
    );
  }

  function obtener(numero) {
    const v = ventas.find((x) => x.numero === Number(numero));
    if (!v) throw new HttpError(404, 'Venta no encontrada');
    return v;
  }

  function exportar() {
    return { siguienteNumero, ventas: structuredClone(ventas) };
  }

  function importar(estado) {
    ventas.splice(0, ventas.length, ...structuredClone(estado.ventas || []));
    siguienteNumero = estado.siguienteNumero || ventas.length + 1;
  }

  return { registrar, listar, obtener, exportar, importar };
}

module.exports = { crearVentas, METODOS_PAGO };
