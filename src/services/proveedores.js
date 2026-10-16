const { HttpError } = require('../errors');

/**
 * Registro de proveedores (droguerías y laboratorios).
 * `diasCredito` indica el plazo que el proveedor da para pagar facturas a crédito.
 */
function crearProveedores() {
  const proveedores = new Map();
  let siguienteId = 1;

  function crear({ nombre, nit, telefono = '', diasCredito = 0 } = {}) {
    if (!nombre || typeof nombre !== 'string') throw new HttpError(400, 'nombre es obligatorio');
    if (!nit || !/^\d{5,15}$/.test(String(nit))) {
      throw new HttpError(400, 'nit debe tener entre 5 y 15 dígitos');
    }
    if (!Number.isInteger(diasCredito) || diasCredito < 0 || diasCredito > 180) {
      throw new HttpError(400, 'diasCredito debe ser un entero entre 0 y 180');
    }
    const nitTexto = String(nit);
    for (const p of proveedores.values()) {
      if (p.nit === nitTexto) throw new HttpError(409, 'Ya existe un proveedor con ese NIT');
    }
    const proveedor = { id: siguienteId++, nombre, nit: nitTexto, telefono: String(telefono), diasCredito };
    proveedores.set(proveedor.id, proveedor);
    return { ...proveedor };
  }

  function obtener(id) {
    const p = proveedores.get(Number(id));
    if (!p) throw new HttpError(404, 'Proveedor no encontrado');
    return { ...p };
  }

  function listar() {
    return [...proveedores.values()].map((p) => ({ ...p }));
  }

  return { crear, obtener, listar };
}

module.exports = { crearProveedores };
