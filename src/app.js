const crypto = require('crypto');
const express = require('express');
const { crearAuth } = require('./auth');
const { crearUsuarios } = require('./services/usuarios');
const { authRouter } = require('./routes/auth');
const { usuariosRouter } = require('./routes/usuarios');
const { crearInventario } = require('./services/inventario');
const { productosRouter } = require('./routes/productos');
const { alertasRouter } = require('./routes/alertas');
const { crearVentas } = require('./services/ventas');
const { ventasRouter } = require('./routes/ventas');
const { crearProveedores } = require('./services/proveedores');
const { crearCompras } = require('./services/compras');
const { proveedoresRouter } = require('./routes/proveedores');
const { comprasRouter } = require('./routes/compras');

const NEGOCIO_POR_DEFECTO = {
  nombre: process.env.FARMACIA_NOMBRE || 'FARMACIA SAN MARTIN',
  direccion: process.env.FARMACIA_DIRECCION || 'Av. Banzer 3er anillo - SCZ',
  nit: process.env.FARMACIA_NIT || '',
};

function createApp({
  inventario = crearInventario(),
  ventas = crearVentas(inventario),
  proveedores = crearProveedores(),
  compras = crearCompras(inventario, proveedores),
  negocio = NEGOCIO_POR_DEFECTO,
  usuarios = crearUsuarios(),
  // Sin JWT_SECRET se usa un secreto aleatorio: los tokens no sobreviven a un reinicio.
  jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtExpiraEn = process.env.JWT_EXPIRA_EN || '8h',
} = {}) {
  const auth = crearAuth({ usuarios, secreto: jwtSecret, expiraEn: jwtExpiraEn });
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', servicio: 'farmacia-pos-api' });
  });

  app.use('/auth', authRouter(auth));

  // Todo lo que sigue requiere sesión iniciada
  app.use(auth.requerirSesion);
  // Permisos: admin = todo; cajero = vender, consultar productos/alertas y su propia caja
  const soloAdmin = auth.permitir('admin');
  app.use('/usuarios', soloAdmin, usuariosRouter(usuarios));
  app.use('/productos', productosRouter(inventario, soloAdmin));
  app.use('/alertas', alertasRouter(inventario));
  app.use('/ventas', ventasRouter(ventas, negocio));
  app.use('/proveedores', soloAdmin, proveedoresRouter(proveedores, compras));
  app.use('/compras', soloAdmin, comprasRouter(compras));

  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Error interno' });
  });

  return app;
}

module.exports = { createApp };
