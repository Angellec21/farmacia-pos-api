const { HttpError } = require('../errors');
const { redondear } = require('./inventario');

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const CONDICIONES = ['contado', 'credito'];

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

/**
 * Compras a proveedores. Cada compra ingresa sus lotes al inventario
 * (todo o nada) y, si es a crédito, genera una cuenta por pagar.
 */
function crearCompras(inventario, proveedores) {
  const compras = [];
  let siguienteNumero = 1;

  function validarFecha(fecha, campo) {
    if (!FECHA_RE.test(fecha || '') || Number.isNaN(Date.parse(fecha))) {
      throw new HttpError(400, `${campo} debe tener formato AAAA-MM-DD`);
    }
  }

  function obtenerInterna(numero) {
    const c = compras.find((x) => x.numero === Number(numero));
    if (!c) throw new HttpError(404, 'Compra no encontrada');
    return c;
  }

  function copia(c) {
    return { ...c, items: c.items.map((i) => ({ ...i })), pagos: c.pagos.map((p) => ({ ...p })) };
  }

  function registrar({ proveedorId, numeroFactura, fecha = hoyISO(), condicion = 'contado', items } = {}) {
    const proveedor = proveedores.obtener(proveedorId);
    if (!numeroFactura) throw new HttpError(400, 'numeroFactura es obligatorio');
    validarFecha(fecha, 'fecha');
    if (!CONDICIONES.includes(condicion)) {
      throw new HttpError(400, `condicion debe ser una de: ${CONDICIONES.join(', ')}`);
    }
    if (condicion === 'credito' && proveedor.diasCredito === 0) {
      throw new HttpError(400, 'Este proveedor no otorga crédito (diasCredito = 0)');
    }
    const factura = String(numeroFactura);
    if (compras.some((c) => c.proveedorId === proveedor.id && c.numeroFactura === factura)) {
      throw new HttpError(409, 'Esa factura del proveedor ya fue registrada');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpError(400, 'items debe ser una lista con al menos un lote');
    }

    // 1) Validar todo antes de tocar el inventario
    const lotesEnCompra = new Set();
    for (const it of items) {
      if (!it || it.productoId === undefined) throw new HttpError(400, 'cada item necesita productoId');
      const datos = { numero: it.lote, vencimiento: it.vencimiento, cantidad: it.cantidad, costoUnitario: it.costoUnitario };
      inventario.validarLote(it.productoId, datos);
      if (it.vencimiento <= fecha) {
        throw new HttpError(400, `El lote ${it.lote} ya está vencido a la fecha de compra`);
      }
      const clave = `${Number(it.productoId)}|${it.lote}`;
      if (lotesEnCompra.has(clave)) throw new HttpError(400, `Lote ${it.lote} repetido en la compra`);
      lotesEnCompra.add(clave);
    }

    // 2) Aplicar
    const detalle = items.map((it) => {
      const producto = inventario.agregarLote(it.productoId, {
        numero: it.lote,
        vencimiento: it.vencimiento,
        cantidad: it.cantidad,
        costoUnitario: it.costoUnitario,
      });
      return {
        productoId: producto.id,
        producto: producto.nombre,
        lote: it.lote,
        vencimiento: it.vencimiento,
        cantidad: it.cantidad,
        costoUnitario: it.costoUnitario,
        subtotal: redondear(it.cantidad * it.costoUnitario),
      };
    });

    const total = redondear(detalle.reduce((s, d) => s + d.subtotal, 0));
    const compra = {
      numero: siguienteNumero++,
      proveedorId: proveedor.id,
      proveedor: proveedor.nombre,
      numeroFactura: factura,
      fecha,
      condicion,
      items: detalle,
      total,
      saldo: condicion === 'credito' ? total : 0,
      vencePago: condicion === 'credito' ? sumarDias(fecha, proveedor.diasCredito) : fecha,
      pagos: [],
    };
    compras.push(compra);
    return copia(compra);
  }

  function abonar(numero, { monto, fecha = hoyISO() } = {}) {
    const c = obtenerInterna(numero);
    validarFecha(fecha, 'fecha');
    if (typeof monto !== 'number' || monto <= 0) throw new HttpError(400, 'monto debe ser mayor a 0');
    if (c.saldo === 0) throw new HttpError(409, 'La compra no tiene saldo pendiente');
    if (redondear(monto) > c.saldo) {
      throw new HttpError(400, `El abono (Bs ${monto.toFixed(2)}) supera el saldo (Bs ${c.saldo.toFixed(2)})`);
    }
    c.pagos.push({ fecha, monto: redondear(monto) });
    c.saldo = redondear(c.saldo - monto);
    return copia(c);
  }

  function listar({ proveedorId, desde, hasta } = {}) {
    return compras
      .filter((c) => proveedorId === undefined || c.proveedorId === Number(proveedorId))
      .filter((c) => !desde || c.fecha >= desde)
      .filter((c) => !hasta || c.fecha <= hasta)
      .map(copia);
  }

  /** Facturas con saldo, ordenadas por fecha de pago, y totales por proveedor. */
  function cuentasPorPagar(hoy = hoyISO()) {
    const pendientes = compras
      .filter((c) => c.saldo > 0)
      .sort((a, b) => a.vencePago.localeCompare(b.vencePago))
      .map((c) => {
        const dias = diasEntre(hoy, c.vencePago);
        return {
          numero: c.numero,
          proveedor: c.proveedor,
          numeroFactura: c.numeroFactura,
          vencePago: c.vencePago,
          saldo: c.saldo,
          diasParaVencer: dias,
          estado: dias < 0 ? 'vencida' : dias <= 7 ? 'por vencer' : 'al dia',
        };
      });
    const porProveedor = {};
    for (const p of pendientes) porProveedor[p.proveedor] = redondear((porProveedor[p.proveedor] || 0) + p.saldo);
    return {
      fecha: hoy,
      totalPorPagar: redondear(pendientes.reduce((s, p) => s + p.saldo, 0)),
      totalVencido: redondear(pendientes.filter((p) => p.estado === 'vencida').reduce((s, p) => s + p.saldo, 0)),
      porProveedor,
      facturas: pendientes,
    };
  }

  return { registrar, abonar, listar, obtener: (n) => copia(obtenerInterna(n)), cuentasPorPagar };
}

module.exports = { crearCompras };
