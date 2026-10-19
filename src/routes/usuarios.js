const express = require('express');

/** Gestión de usuarios: solo el administrador (el router se monta con permitir('admin')). */
function usuariosRouter(usuarios) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(usuarios.listar());
  });

  router.post('/', (req, res) => {
    res.status(201).json(usuarios.crear(req.body || {}));
  });

  router.patch('/:id', (req, res) => {
    res.json(usuarios.cambiarEstado(req.params.id, (req.body || {}).activo));
  });

  return router;
}

module.exports = { usuariosRouter };
