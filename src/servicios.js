const { crearUsuarios } = require('./services/usuarios');
const { crearInventario } = require('./services/inventario');
const { crearVentas } = require('./services/ventas');
const { crearProveedores } = require('./services/proveedores');
const { crearCompras } = require('./services/compras');

/** Crea todos los servicios conectados entre sí (mismo inventario para ventas y compras). */
function crearServicios() {
  const usuarios = crearUsuarios();
  const inventario = crearInventario();
  const proveedores = crearProveedores();
  return {
    usuarios,
    inventario,
    proveedores,
    ventas: crearVentas(inventario),
    compras: crearCompras(inventario, proveedores),
  };
}

module.exports = { crearServicios };
