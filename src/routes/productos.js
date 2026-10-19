const express = require('express');

/** Lectura para todos; altas, lotes y salidas manuales solo para el admin. */
function productosRouter(inventario, soloAdmin) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(inventario.listar());
  });

  router.post('/', soloAdmin, (req, res) => {
    res.status(201).json(inventario.crearProducto(req.body || {}));
  });

  router.get('/:id', (req, res) => {
    res.json(inventario.obtener(req.params.id));
  });

  router.post('/:id/lotes', soloAdmin, (req, res) => {
    res.status(201).json(inventario.agregarLote(req.params.id, req.body || {}));
  });

  router.post('/:id/salidas', soloAdmin, (req, res) => {
    const { cantidad, fecha } = req.body || {};
    res.json(inventario.descontar(req.params.id, cantidad, fecha));
  });

  return router;
}

module.exports = { productosRouter };
