const { crearAppDePrueba } = require('./helpers/sesion');

async function prepararVentas() {
  const sesion = await crearAppDePrueba();
  const { admin, cajero } = sesion;
  await admin.post('/productos').send({ nombre: 'Ibuprofeno 400mg', codigo: 'IBU400', precioVenta: 2 });
  await admin.post('/productos').send({ nombre: 'Omeprazol 20mg', codigo: 'OME20', precioVenta: 2.5 });
  await admin.post('/productos/1/lotes')
    .send({ numero: 'IB-01', vencimiento: '2027-12-31', cantidad: 100, costoUnitario: 0.9 });
  await admin.post('/productos/2/lotes')
    .send({ numero: 'OM-01', vencimiento: '2027-06-30', cantidad: 50, costoUnitario: 1.75 });
  await cajero.post('/ventas').send({ items: [{ productoId: 1, cantidad: 12 }], fecha: '2026-10-05' });
  await cajero.post('/ventas')
    .send({ items: [{ productoId: 2, cantidad: 4 }], metodoPago: 'qr', fecha: '2026-10-06' });
  await admin.post('/ventas')
    .send({ items: [{ productoId: 1, cantidad: 3 }, { productoId: 2, cantidad: 6 }], fecha: '2026-10-07' });
  return sesion;
}

describe('API de reportes del dueño', () => {
  let sesion;
  beforeAll(async () => {
    sesion = await prepararVentas();
  });

  test('GET /reportes/mas-vendidos ordena por unidades', async () => {
    const r = await sesion.admin.get('/reportes/mas-vendidos');
    expect(r.status).toBe(200);
    expect(r.body.map((f) => [f.codigo, f.unidades, f.ingresosBs])).toEqual([
      ['IBU400', 15, 30],
      ['OME20', 10, 25],
    ]);
  });

  test('GET /reportes/mas-vendidos respeta periodo, orden y límite', async () => {
    const r = await sesion.admin.get('/reportes/mas-vendidos?desde=2026-10-06&orden=ingresos&limite=1');
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).toMatchObject({ codigo: 'OME20', ingresosBs: 25, participacion: 80.65 });
  });

  test('GET /reportes/margen-productos usa el costo real de los lotes', async () => {
    const r = await sesion.admin.get('/reportes/margen-productos');
    expect(r.body.map((f) => [f.codigo, f.margenBs, f.margenPorcentaje])).toEqual([
      ['OME20', 7.5, 30],
      ['IBU400', 16.5, 55],
    ]);
  });

  test('GET /reportes/ventas-cajero separa la caja de cada usuario', async () => {
    const r = await sesion.admin.get('/reportes/ventas-cajero');
    expect(r.body.map((c) => [c.cajero, c.ventas, c.totalBs])).toEqual([
      ['Luis Vaca', 2, 34],
      ['Rosa Gutiérrez', 1, 21],
    ]);
    expect(r.body[0].porMetodo).toEqual({ efectivo: 24, qr: 10 });
  });

  test('rechaza parámetros inválidos con 400', async () => {
    for (const url of [
      '/reportes/margen-productos?desde=05-10-2026',
      '/reportes/ventas-cajero?desde=2026-10-31&hasta=2026-10-01',
      '/reportes/mas-vendidos?limite=0',
      '/reportes/mas-vendidos?orden=precio',
    ]) {
      const r = await sesion.admin.get(url);
      expect(r.status).toBe(400);
    }
  });

  test('el cajero no puede ver reportes (403)', async () => {
    const r = await sesion.cajero.get('/reportes/margen-productos');
    expect(r.status).toBe(403);
  });
});
