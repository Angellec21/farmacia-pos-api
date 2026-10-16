const request = require('supertest');
const { createApp } = require('../src/app');

describe('API /proveedores y /compras', () => {
  let app;
  beforeEach(async () => {
    app = createApp();
    await request(app).post('/productos').send({ nombre: 'Amoxicilina 500mg', codigo: 'AMX500', precioVenta: 3.5 });
    await request(app).post('/proveedores')
      .send({ nombre: 'Droguería INTI - Santa Cruz', nit: '1020304025', diasCredito: 30 });
  });

  const compra = {
    proveedorId: 1,
    numeroFactura: 'F-881',
    fecha: '2026-10-16',
    condicion: 'credito',
    items: [{ productoId: 1, lote: 'AMX-77', vencimiento: '2027-05-31', cantidad: 100, costoUnitario: 1.9 }],
  };

  test('registra compra a crédito y el stock queda disponible', async () => {
    const res = await request(app).post('/compras').send(compra);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ total: 190, saldo: 190, vencePago: '2026-11-15' });
    const prod = await request(app).get('/productos/1');
    expect(prod.body.stock).toBe(100);
    const hist = await request(app).get('/proveedores/1/compras');
    expect(hist.body).toHaveLength(1);
  });

  test('abono parcial y cuentas por pagar', async () => {
    await request(app).post('/compras').send(compra);
    const pago = await request(app).post('/compras/1/pagos').send({ monto: 90, fecha: '2026-10-20' });
    expect(pago.status).toBe(201);
    expect(pago.body.saldo).toBe(100);
    const cxp = await request(app).get('/compras/cuentas-por-pagar?fecha=2026-11-20');
    expect(cxp.body.totalVencido).toBe(100);
    expect(cxp.body.facturas[0].estado).toBe('vencida');
  });

  test('errores: proveedor inexistente 404, factura duplicada 409, abono excesivo 400', async () => {
    expect((await request(app).post('/compras').send({ ...compra, proveedorId: 9 })).status).toBe(404);
    await request(app).post('/compras').send(compra);
    const dup = await request(app).post('/compras').send({ ...compra, items: [{ ...compra.items[0], lote: 'OTRO' }] });
    expect(dup.status).toBe(409);
    expect((await request(app).post('/compras/1/pagos').send({ monto: 500 })).status).toBe(400);
    expect((await request(app).get('/compras/99')).status).toBe(404);
  });

  test('filtra compras por rango de fechas', async () => {
    await request(app).post('/compras').send(compra);
    expect((await request(app).get('/compras?desde=2026-10-01&hasta=2026-10-31')).body).toHaveLength(1);
    expect((await request(app).get('/compras?desde=2026-11-01')).body).toHaveLength(0);
  });
});
