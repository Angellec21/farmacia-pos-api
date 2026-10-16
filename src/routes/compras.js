const express = require('express');

function comprasRouter(compras) {
  const router = express.Router();

  router.post('/', (req, res) => {
    res.status(201).json(compras.registrar(req.body || {}));
  });

  router.get('/', (req, res) => {
    const { proveedorId, desde, hasta } = req.query;
    res.json(compras.listar({ proveedorId, desde, hasta }));
  });

  router.get('/cuentas-por-pagar', (req, res) => {
    res.json(compras.cuentasPorPagar(req.query.fecha || undefined));
  });

  router.get('/:numero', (req, res) => {
    res.json(compras.obtener(req.params.numero));
  });

  router.post('/:numero/pagos', (req, res) => {
    res.status(201).json(compras.abonar(req.params.numero, req.body || {}));
  });

  return router;
}

module.exports = { comprasRouter };
