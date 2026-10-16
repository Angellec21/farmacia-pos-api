const express = require('express');

function proveedoresRouter(proveedores, compras) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(proveedores.listar());
  });

  router.post('/', (req, res) => {
    res.status(201).json(proveedores.crear(req.body || {}));
  });

  router.get('/:id', (req, res) => {
    res.json(proveedores.obtener(req.params.id));
  });

  router.get('/:id/compras', (req, res) => {
    const proveedor = proveedores.obtener(req.params.id);
    res.json(compras.listar({ proveedorId: proveedor.id }));
  });

  return router;
}

module.exports = { proveedoresRouter };
