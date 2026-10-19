const request = require('supertest');
const { createApp } = require('../../src/app');
const { crearUsuarios } = require('../../src/services/usuarios');

const METODOS = ['get', 'post', 'patch', 'put', 'delete'];

/** Cliente supertest que envía siempre el token del usuario. */
function clienteCon(app, token) {
  const cliente = {};
  for (const m of METODOS) {
    cliente[m] = (url) => request(app)[m](url).set('Authorization', `Bearer ${token}`);
  }
  return cliente;
}

/**
 * Crea una app de prueba con un admin y un cajero ya registrados y devuelve
 * clientes autenticados para cada uno.
 */
async function crearAppDePrueba(opciones = {}) {
  const usuarios = opciones.usuarios || crearUsuarios();
  usuarios.crear({ usuario: 'admin', nombre: 'Rosa Gutiérrez', password: 'clave-admin-1', rol: 'admin' });
  usuarios.crear({ usuario: 'cajero', nombre: 'Luis Vaca', password: 'clave-cajero-1', rol: 'cajero' });
  const app = createApp({ jwtSecret: 'secreto-de-pruebas', ...opciones, usuarios });
  const token = async (usuario, password) =>
    (await request(app).post('/auth/login').send({ usuario, password })).body.token;
  return {
    app,
    usuarios,
    admin: clienteCon(app, await token('admin', 'clave-admin-1')),
    cajero: clienteCon(app, await token('cajero', 'clave-cajero-1')),
  };
}

module.exports = { crearAppDePrueba, clienteCon };
