const express = require('express');
const { crearInventario } = require('./services/inventario');
const { productosRouter } = require('./routes/productos');

function createApp({ inventario = crearInventario() } = {}) {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', servicio: 'farmacia-pos-api' });
  });

  app.use('/productos', productosRouter(inventario));

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
