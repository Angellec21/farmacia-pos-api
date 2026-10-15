const express = require('express');
const { ticketTexto, cierreDiario } = require('../services/reportes');

function ventasRouter(ventas, negocio = {}) {
  const router = express.Router();

  router.post('/', (req, res) => {
    res.status(201).json(ventas.registrar(req.body || {}));
  });

  router.get('/', (req, res) => {
    res.json(ventas.listar({ fecha: req.query.fecha }));
  });

  router.get('/cierre', (req, res) => {
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    res.json(cierreDiario(ventas.listar(), fecha));
  });

  router.get('/:numero/ticket', (req, res) => {
    res.type('text/plain; charset=utf-8').send(ticketTexto(ventas.obtener(req.params.numero), negocio));
  });

  router.get('/:numero', (req, res) => {
    res.json(ventas.obtener(req.params.numero));
  });

  return router;
}

module.exports = { ventasRouter };
