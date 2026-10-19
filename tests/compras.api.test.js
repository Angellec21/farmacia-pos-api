const { crearAppDePrueba } = require('./helpers/sesion');

describe('API /proveedores y /compras', () => {
  let api;
  beforeEach(async () => {
    ({ admin: api } = await crearAppDePrueba());
    await api.post('/productos').send({ nombre: 'Amoxicilina 500mg', codigo: 'AMX500', precioVenta: 3.5 });
    await api.post('/proveedores')
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
    const res = await api.post('/compras').send(compra);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ total: 190, saldo: 190, vencePago: '2026-11-15' });
    const prod = await api.get('/productos/1');
    expect(prod.body.stock).toBe(100);
    const hist = await api.get('/proveedores/1/compras');
    expect(hist.body).toHaveLength(1);
  });

  test('abono parcial y cuentas por pagar', async () => {
    await api.post('/compras').send(compra);
    const pago = await api.post('/compras/1/pagos').send({ monto: 90, fecha: '2026-10-20' });
    expect(pago.status).toBe(201);
    expect(pago.body.saldo).toBe(100);
    const cxp = await api.get('/compras/cuentas-por-pagar?fecha=2026-11-20');
    expect(cxp.body.totalVencido).toBe(100);
    expect(cxp.body.facturas[0].estado).toBe('vencida');
  });

  test('errores: proveedor inexistente 404, factura duplicada 409, abono excesivo 400', async () => {
    expect((await api.post('/compras').send({ ...compra, proveedorId: 9 })).status).toBe(404);
    await api.post('/compras').send(compra);
    const dup = await api.post('/compras').send({ ...compra, items: [{ ...compra.items[0], lote: 'OTRO' }] });
    expect(dup.status).toBe(409);
    expect((await api.post('/compras/1/pagos').send({ monto: 500 })).status).toBe(400);
    expect((await api.get('/compras/99')).status).toBe(404);
  });

  test('filtra compras por rango de fechas', async () => {
    await api.post('/compras').send(compra);
    expect((await api.get('/compras?desde=2026-10-01&hasta=2026-10-31')).body).toHaveLength(1);
    expect((await api.get('/compras?desde=2026-11-01')).body).toHaveLength(0);
  });
});
