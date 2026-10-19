const express = require('express');
const { HttpError } = require('../errors');
const { ticketTexto, cierreDiario } = require('../services/reportes');

const esAdmin = (req) => req.usuario.rol === 'admin';

/** El cajero no ve costos ni márgenes: son información del dueño. */
function sinCostos({ costo, margen, items, ...venta }) {
  return { ...venta, items: items.map(({ costo: _c, ...it }) => it) };
}

function ventasRouter(ventas, negocio = {}) {
  const router = express.Router();

  // El cajero solo puede ver sus propias ventas
  function obtenerVisible(req) {
    const v = ventas.obtener(req.params.numero);
    if (!esAdmin(req) && (!v.cajero || v.cajero.id !== req.usuario.id)) {
      throw new HttpError(404, 'Venta no encontrada');
    }
    return v;
  }
  const vista = (req, v) => (esAdmin(req) ? v : sinCostos(v));

  router.post('/', (req, res) => {
    const venta = ventas.registrar(req.body || {}, req.usuario);
    res.status(201).json(vista(req, venta));
  });

  router.get('/', (req, res) => {
    const filtro = { fecha: req.query.fecha };
    if (!esAdmin(req)) filtro.cajeroId = req.usuario.id;
    else if (req.query.cajeroId !== undefined) filtro.cajeroId = Number(req.query.cajeroId);
    res.json(ventas.listar(filtro).map((v) => vista(req, v)));
  });

  // Cierre del día: el admin ve todo el local; el cajero, solo su caja y sin márgenes
  router.get('/cierre', (req, res) => {
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    if (esAdmin(req)) {
      const filtro = req.query.cajeroId !== undefined ? { cajeroId: Number(req.query.cajeroId) } : {};
      return res.json(cierreDiario(ventas.listar(filtro), fecha));
    }
    const { costoBs, margenBs, margenPorcentaje, ...cierre } = cierreDiario(
      ventas.listar({ cajeroId: req.usuario.id }),
      fecha,
    );
    return res.json({ ...cierre, cajero: req.usuario.nombre });
  });

  router.get('/:numero/ticket', (req, res) => {
    res.type('text/plain; charset=utf-8').send(ticketTexto(obtenerVisible(req), negocio));
  });

  router.get('/:numero', (req, res) => {
    res.json(vista(req, obtenerVisible(req)));
  });

  return router;
}

module.exports = { ventasRouter, sinCostos };
