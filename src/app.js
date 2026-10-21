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
const { reportesRouter } = require('./routes/reportes');
const { exportarEstado } = require('./persistencia');

const METODOS_DE_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

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
  // Opcional: si se pasa un almacén, el estado se guarda tras cada operación exitosa que modifica datos.
  almacen = null,
  registrarError = (msg) => console.error(msg),
} = {}) {
  const auth = crearAuth({ usuarios, secreto: jwtSecret, expiraEn: jwtExpiraEn });
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  if (almacen) {
    const servicios = { usuarios, inventario, proveedores, compras, ventas };
    app.use((req, res, next) => {
      if (METODOS_DE_LECTURA.has(req.method) || req.path === '/auth/login') return next();
      // Se guarda justo antes de responder: si el cliente recibe "ok", el dato ya está en disco.
      const terminar = res.end;
      res.end = function endConGuardado(...args) {
        res.end = terminar;
        // Las operaciones rechazadas no cambian nada (todo o nada), así que no se guardan.
        if (res.statusCode < 400) {
          try {
            almacen.escribir(exportarEstado(servicios));
          } catch (err) {
            registrarError(`[error] no se pudo guardar el estado: ${err.message}`);
          }
        }
        return terminar.apply(this, args);
      };
      next();
    });
  }

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
  app.use('/reportes', soloAdmin, reportesRouter(ventas));

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
