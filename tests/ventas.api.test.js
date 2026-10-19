const { crearAppDePrueba } = require('./helpers/sesion');

describe('API /ventas', () => {
  let api;
  beforeEach(async () => {
    ({ admin: api } = await crearAppDePrueba());
    await api.post('/productos')
      .send({ nombre: 'Omeprazol 20mg', codigo: 'OME20', precioVenta: 2.5, stockMinimo: 10 });
    await api.post('/productos/1/lotes')
      .send({ numero: 'O-01', vencimiento: '2027-04-30', cantidad: 30, costoUnitario: 1.2 });
  });

  test('POST /ventas registra la venta y descuenta stock', async () => {
    const res = await api.post('/ventas')
      .send({ items: [{ productoId: 1, cantidad: 4 }], metodoPago: 'qr', cliente: 'María Rojas', nit: '4567891' });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(10);
    const prod = await api.get('/productos/1');
    expect(prod.body.stock).toBe(26);
  });

  test('responde 409 sin stock y 404 si el producto no existe', async () => {
    const sinStock = await api.post('/ventas').send({ items: [{ productoId: 1, cantidad: 100 }] });
    expect(sinStock.status).toBe(409);
    const noExiste = await api.post('/ventas').send({ items: [{ productoId: 7, cantidad: 1 }] });
    expect(noExiste.status).toBe(404);
  });

  test('GET /ventas y /ventas/:numero', async () => {
    await api.post('/ventas').send({ items: [{ productoId: 1, cantidad: 1 }], fecha: '2026-10-15' });
    const lista = await api.get('/ventas?fecha=2026-10-15');
    expect(lista.body).toHaveLength(1);
    const una = await api.get('/ventas/1');
    expect(una.body.items[0].codigo).toBe('OME20');
    expect((await api.get('/ventas/5')).status).toBe(404);
  });
});
