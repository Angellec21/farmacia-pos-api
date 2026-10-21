const crypto = require('crypto');
const { createApp } = require('./app');
const { crearServicios } = require('./servicios');
const { crearAlmacen, importarEstado, exportarEstado } = require('./persistencia');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || 'data/farmacia.json';

if (!process.env.JWT_SECRET) {
  console.warn('[aviso] JWT_SECRET no está definido: se usa un secreto temporal y las sesiones se pierden al reiniciar.');
}

const servicios = crearServicios();
const almacen = crearAlmacen(DATA_FILE);
const guardado = almacen.leer();
if (guardado) {
  importarEstado(servicios, guardado);
  console.log(`Datos cargados desde ${almacen.ruta} (${servicios.inventario.listar().length} productos, ${servicios.ventas.listar().length} ventas)`);
}

// Primer administrador (solo si todavía no hay usuarios): desde variables de entorno o con contraseña temporal.
if (servicios.usuarios.cantidad() === 0) {
  const adminUsuario = process.env.ADMIN_USUARIO || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  servicios.usuarios.crear({ usuario: adminUsuario, nombre: 'Administrador', password: adminPassword, rol: 'admin' });
  almacen.escribir(exportarEstado(servicios));
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`Administrador inicial: ${adminUsuario} / ${adminPassword} (defina ADMIN_PASSWORD para fijarla)`);
  }
}

createApp({ ...servicios, almacen }).listen(PORT, () => {
  console.log(`farmacia-pos-api escuchando en http://localhost:${PORT} (datos en ${almacen.ruta})`);
});
