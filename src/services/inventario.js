const { HttpError } = require('../errors');

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function redondear(n) {
  return Math.round(n * 100) / 100;
}

function crearInventario() {
  const productos = new Map();
  let siguienteId = 1;

  function obtener(id) {
    const p = productos.get(Number(id));
    if (!p) throw new HttpError(404, 'Producto no encontrado');
    return p;
  }

  function stockTotal(p) {
    return p.lotes.reduce((s, l) => s + l.cantidad, 0);
  }

  function resumen(p) {
    return { ...p, lotes: [...p.lotes], stock: stockTotal(p) };
  }

  function crearProducto({ nombre, codigo, precioVenta, stockMinimo = 0 }) {
    if (!nombre || typeof nombre !== 'string') throw new HttpError(400, 'nombre es obligatorio');
    if (!codigo || typeof codigo !== 'string') throw new HttpError(400, 'codigo es obligatorio');
    if (typeof precioVenta !== 'number' || precioVenta <= 0) {
      throw new HttpError(400, 'precioVenta debe ser un número mayor a 0');
    }
    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
      throw new HttpError(400, 'stockMinimo debe ser un entero >= 0');
    }
    for (const p of productos.values()) {
      if (p.codigo === codigo) throw new HttpError(409, 'Ya existe un producto con ese código');
    }
    const producto = { id: siguienteId++, nombre, codigo, precioVenta, stockMinimo, lotes: [] };
    productos.set(producto.id, producto);
    return resumen(producto);
  }

  function listar() {
    return [...productos.values()].map(resumen);
  }

  function agregarLote(productoId, { numero, vencimiento, cantidad, costoUnitario }) {
    const p = obtener(productoId);
    if (!numero) throw new HttpError(400, 'numero de lote es obligatorio');
    if (!FECHA_RE.test(vencimiento || '') || Number.isNaN(Date.parse(vencimiento))) {
      throw new HttpError(400, 'vencimiento debe tener formato AAAA-MM-DD');
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new HttpError(400, 'cantidad debe ser un entero mayor a 0');
    }
    if (typeof costoUnitario !== 'number' || costoUnitario < 0) {
      throw new HttpError(400, 'costoUnitario debe ser un número >= 0');
    }
    if (p.lotes.some((l) => l.numero === numero)) {
      throw new HttpError(409, 'Ese número de lote ya está registrado');
    }
    const lote = { numero, vencimiento, cantidad, costoUnitario };
    p.lotes.push(lote);
    // Orden FEFO: el que vence primero, primero
    p.lotes.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
    return resumen(p);
  }

  /**
   * Descuenta stock usando FEFO. Nunca usa lotes vencidos a la fecha `hoy`.
   * Devuelve el detalle de qué lotes se usaron.
   */
  function descontar(productoId, cantidad, hoy = new Date().toISOString().slice(0, 10)) {
    const p = obtener(productoId);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new HttpError(400, 'cantidad debe ser un entero mayor a 0');
    }
    const vigentes = p.lotes.filter((l) => l.vencimiento >= hoy && l.cantidad > 0);
    const disponible = vigentes.reduce((s, l) => s + l.cantidad, 0);
    if (disponible < cantidad) {
      throw new HttpError(409, `Stock vigente insuficiente: hay ${disponible}, se piden ${cantidad}`);
    }
    let restante = cantidad;
    const usados = [];
    for (const lote of vigentes) {
      if (restante === 0) break;
      const toma = Math.min(lote.cantidad, restante);
      lote.cantidad -= toma;
      restante -= toma;
      usados.push({
        lote: lote.numero,
        vencimiento: lote.vencimiento,
        cantidad: toma,
        costoUnitario: lote.costoUnitario,
      });
    }
    p.lotes = p.lotes.filter((l) => l.cantidad > 0);
    const costoTotal = redondear(usados.reduce((s, u) => s + u.cantidad * u.costoUnitario, 0));
    return { producto: resumen(p), usados, costoTotal };
  }

  return { crearProducto, listar, obtener: (id) => resumen(obtener(id)), agregarLote, descontar };
}

module.exports = { crearInventario, redondear };
