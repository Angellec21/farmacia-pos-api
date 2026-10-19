const request = require('supertest');
const { crearAppDePrueba, clienteCon } = require('./helpers/sesion');

describe('permisos por rol', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await crearAppDePrueba();
    await ctx.admin.post('/productos')
      .send({ nombre: 'Paracetamol 500mg', codigo: 'PAR500', precioVenta: 1.5, stockMinimo: 20 });
    await ctx.admin.post('/productos/1/lotes')
      .send({ numero: 'P-01', vencimiento: '2027-06-30', cantidad: 100, costoUnitario: 0.5 });
  });

  test('el cajero consulta productos y alertas pero no los modifica', async () => {
    expect((await ctx.cajero.get('/productos')).status).toBe(200);
    expect((await ctx.cajero.get('/productos/1')).status).toBe(200);
    expect((await ctx.cajero.get('/alertas/stock-bajo')).status).toBe(200);
    expect((await ctx.cajero.post('/productos').send({ nombre: 'X', codigo: 'X', precioVenta: 1 })).status).toBe(403);
    const lote = await ctx.cajero.post('/productos/1/lotes')
      .send({ numero: 'P-02', vencimiento: '2027-07-30', cantidad: 5, costoUnitario: 0.5 });
    expect(lote.status).toBe(403);
    expect((await ctx.cajero.post('/productos/1/salidas').send({ cantidad: 1 })).status).toBe(403);
  });

  test('el cajero no accede a proveedores ni compras', async () => {
    expect((await ctx.cajero.get('/proveedores')).status).toBe(403);
    expect((await ctx.cajero.get('/compras/cuentas-por-pagar')).status).toBe(403);
    expect((await ctx.cajero.post('/compras').send({})).status).toBe(403);
    expect((await ctx.admin.get('/proveedores')).status).toBe(200);
  });

  test('la venta registra al cajero de la sesión (no el del cuerpo) y oculta costos al cajero', async () => {
    const res = await ctx.cajero.post('/ventas')
      .send({ items: [{ productoId: 1, cantidad: 10 }], cajero: { id: 1, nombre: 'Falso' } });
    expect(res.status).toBe(201);
    expect(res.body.cajero).toEqual({ id: 2, nombre: 'Luis Vaca' });
    expect(res.body.costo).toBeUndefined();
    expect(res.body.margen).toBeUndefined();
    expect(res.body.items[0].costo).toBeUndefined();
    expect(res.body.items[0].lotes[0].lote).toBe('P-01');

    const comoAdmin = await ctx.admin.get('/ventas/1');
    expect(comoAdmin.body).toMatchObject({ costo: 5, margen: 10 });
    const ticket = await ctx.cajero.get('/ventas/1/ticket');
    expect(ticket.text).toContain('Cajero: Luis Vaca');
  });

  test('cada cajero ve solo sus ventas; el admin ve todas y puede filtrar por cajero', async () => {
    await ctx.admin.post('/usuarios')
      .send({ usuario: 'carla', nombre: 'Carla Suárez', password: 'clave-carla-1', rol: 'cajero' });
    const login = await request(ctx.app).post('/auth/login')
      .send({ usuario: 'carla', password: 'clave-carla-1' });
    const carla = clienteCon(ctx.app, login.body.token);

    await ctx.cajero.post('/ventas').send({ items: [{ productoId: 1, cantidad: 2 }], fecha: '2026-10-19' });
    await carla.post('/ventas').send({ items: [{ productoId: 1, cantidad: 4 }], fecha: '2026-10-19' });

    expect((await ctx.cajero.get('/ventas')).body.map((v) => v.numero)).toEqual([1]);
    expect((await carla.get('/ventas')).body.map((v) => v.numero)).toEqual([2]);
    expect((await carla.get('/ventas/1')).status).toBe(404);
    expect((await carla.get('/ventas/1/ticket')).status).toBe(404);
    expect((await ctx.admin.get('/ventas')).body).toHaveLength(2);
    expect((await ctx.admin.get('/ventas?cajeroId=3')).body.map((v) => v.numero)).toEqual([2]);
  });

  test('cierre de caja: el cajero ve su caja sin márgenes; el admin, todo el local', async () => {
    await ctx.cajero.post('/ventas')
      .send({ items: [{ productoId: 1, cantidad: 10 }], metodoPago: 'qr', fecha: '2026-10-19' });
    await ctx.admin.post('/ventas').send({ items: [{ productoId: 1, cantidad: 2 }], fecha: '2026-10-19' });

    const delCajero = await ctx.cajero.get('/ventas/cierre?fecha=2026-10-19');
    expect(delCajero.body).toMatchObject({ cajero: 'Luis Vaca', cantidadVentas: 1, totalBs: 15 });
    expect(delCajero.body.margenBs).toBeUndefined();
    expect(delCajero.body.costoBs).toBeUndefined();

    const local = await ctx.admin.get('/ventas/cierre?fecha=2026-10-19');
    expect(local.body).toMatchObject({ cantidadVentas: 2, totalBs: 18, costoBs: 6, margenBs: 12 });
    const soloLuis = await ctx.admin.get('/ventas/cierre?fecha=2026-10-19&cajeroId=2');
    expect(soloLuis.body).toMatchObject({ cantidadVentas: 1, margenBs: 10 });
  });
});
