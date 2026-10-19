const express = require('express');

function authRouter(auth) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    res.json(auth.login(req.body || {}));
  });

  router.get('/yo', auth.requerirSesion, (req, res) => {
    res.json(req.usuario);
  });

  return router;
}

module.exports = { authRouter };
