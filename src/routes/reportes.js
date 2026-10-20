const express = require('express');
const { HttpError } = require('../errors');
const { masVendidos, margenPorProducto, ventasPorCajero, validarPeriodo } = require('../services/reportes');

/** Reportes gerenciales del dueño (solo admin). Periodo opcional: ?desde=&hasta= */
function reportesRouter(ventas) {
  const router = express.Router();

  function periodo(req) {
    const { desde, hasta } = req.query;
    const error = validarPeriodo({ desde, hasta });
    if (error) throw new HttpError(400, error);
    return { desde, hasta };
  }

  router.get('/mas-vendidos', (req, res) => {
    const limite = req.query.limite === undefined ? 10 : Number(req.query.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw new HttpError(400, 'limite debe ser un entero entre 1 y 100');
    }
    const orden = req.query.orden || 'unidades';
    if (!['unidades', 'ingresos'].includes(orden)) {
      throw new HttpError(400, 'orden debe ser unidades o ingresos');
    }
    res.json(masVendidos(ventas.listar(), { ...periodo(req), limite, orden }));
  });

  router.get('/margen-productos', (req, res) => {
    res.json(margenPorProducto(ventas.listar(), periodo(req)));
  });

  router.get('/ventas-cajero', (req, res) => {
    res.json(ventasPorCajero(ventas.listar(), periodo(req)));
  });

  return router;
}

module.exports = { reportesRouter };
