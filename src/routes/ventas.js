const express = require('express');

function ventasRouter(ventas) {
  const router = express.Router();

  router.post('/', (req, res) => {
    res.status(201).json(ventas.registrar(req.body || {}));
  });

  router.get('/', (req, res) => {
    res.json(ventas.listar({ fecha: req.query.fecha }));
  });

  router.get('/:numero', (req, res) => {
    res.json(ventas.obtener(req.params.numero));
  });

  return router;
}

module.exports = { ventasRouter };
