const express = require('express');
const { HttpError } = require('../errors');
const { lotesPorVencer, stockBajo } = require('../services/alertas');

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function alertasRouter(inventario) {
  const router = express.Router();

  router.get('/vencimientos', (req, res) => {
    const dias = req.query.dias === undefined ? 30 : Number(req.query.dias);
    if (!Number.isInteger(dias) || dias < 0) throw new HttpError(400, 'dias debe ser un entero >= 0');
    const hoy = req.query.hoy || hoyISO();
    res.json(lotesPorVencer(inventario.listar(), { hoy, dias }));
  });

  router.get('/stock-bajo', (req, res) => {
    const hoy = req.query.hoy || hoyISO();
    res.json(stockBajo(inventario.listar(), { hoy }));
  });

  return router;
}

module.exports = { alertasRouter };
