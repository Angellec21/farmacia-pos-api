const request = require('supertest');
const { createApp } = require('../src/app');

describe('API /productos', () => {
  let app;
  beforeEach(() => {
    app = createApp();
  });

  test('crea y lista productos', async () => {
    const creado = await request(app)
      .post('/productos')
      .send({ nombre: 'Amoxicilina 500mg', codigo: 'AMX500', precioVenta: 3.5, stockMinimo: 10 });
    expect(creado.status).toBe(201);
    const lista = await request(app).get('/productos');
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].codigo).toBe('AMX500');
  });

  test('valida datos y responde 400', async () => {
    const res = await request(app).post('/productos').send({ nombre: 'Sin código', precioVenta: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/codigo/);
  });

  test('agrega lote y registra salida FEFO', async () => {
    await request(app).post('/productos').send({ nombre: 'Loratadina', codigo: 'LOR10', precioVenta: 2 });
    await request(app).post('/productos/1/lotes')
      .send({ numero: 'L2', vencimiento: '2027-03-01', cantidad: 5, costoUnitario: 1 });
    await request(app).post('/productos/1/lotes')
      .send({ numero: 'L1', vencimiento: '2026-11-01', cantidad: 5, costoUnitario: 1 });
    const res = await request(app).post('/productos/1/salidas').send({ cantidad: 7, fecha: '2026-10-08' });
    expect(res.status).toBe(200);
    expect(res.body.usados.map((u) => u.lote)).toEqual(['L1', 'L2']);
    expect(res.body.producto.stock).toBe(3);
  });

  test('salida sin stock responde 409', async () => {
    await request(app).post('/productos').send({ nombre: 'X', codigo: 'X', precioVenta: 1 });
    const res = await request(app).post('/productos/1/salidas').send({ cantidad: 1 });
    expect(res.status).toBe(409);
  });
});
