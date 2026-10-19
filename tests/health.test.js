const request = require('supertest');
const { createApp } = require('../src/app');
const { crearAppDePrueba } = require('./helpers/sesion');

describe('GET /health', () => {
  test('responde ok sin necesidad de sesión', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('ruta inexistente devuelve 404 en JSON (con sesión)', async () => {
    const { admin } = await crearAppDePrueba();
    const res = await admin.get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Ruta no encontrada');
  });
});
