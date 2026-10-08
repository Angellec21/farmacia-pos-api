const request = require('supertest');
const { createApp } = require('../src/app');

describe('GET /health', () => {
  test('responde ok', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('ruta inexistente devuelve 404 en JSON', async () => {
    const res = await request(createApp()).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Ruta no encontrada');
  });
});
