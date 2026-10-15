const request = require('supertest');
const { createApp } = require('../src/app');
const { ticketTexto, cierreDiario, ANCHO } = require('../src/services/reportes');

const venta = {
  numero: 7,
  fecha: '2026-10-15',
  cliente: 'Juan Pérez',
  nit: '7894561',
  metodoPago: 'efectivo',
  items: [
    { producto: 'Paracetamol 500mg', cantidad: 10, precioUnitario: 1.5, subtotal: 15 },
    { producto: 'Sales de rehidratación oral', cantidad: 2, precioUnitario: 4, subtotal: 8 },
  ],
  total: 23,
  costo: 11,
  montoRecibido: 50,
  cambio: 27,
};

describe('ticket', () => {
  test('imprime total, cambio y no excede el ancho de 58 mm', () => {
    const t = ticketTexto(venta, { nombre: 'FARMACIA SAN MARTIN', nit: '1023456789' });
    expect(t).toContain('NIT 1023456789');
    expect(t).toMatch(/TOTAL\s+Bs 23\.00/);
    expect(t).toMatch(/Cambio\s+Bs 27\.00/);
    for (const l of t.trimEnd().split('\n')) expect(l.length).toBeLessThanOrEqual(ANCHO);
  });

  test('omite el cambio si no se pagó en efectivo con monto', () => {
    const t = ticketTexto({ ...venta, metodoPago: 'qr', montoRecibido: null, cambio: null });
    expect(t).not.toContain('Cambio');
    expect(t).toMatch(/Pago\s+QR/);
  });
});

describe('cierre diario', () => {
  test('totaliza por método de pago, margen y ticket promedio', () => {
    const otras = [
      { ...venta, numero: 8, metodoPago: 'qr', total: 17, costo: 9 },
      { ...venta, numero: 9, fecha: '2026-10-14' },
    ];
    const c = cierreDiario([venta, ...otras], '2026-10-15');
    expect(c.cantidadVentas).toBe(2);
    expect(c.totalBs).toBe(40);
    expect(c.margenBs).toBe(20);
    expect(c.margenPorcentaje).toBe(50);
    expect(c.ticketPromedioBs).toBe(20);
    expect(c.unidadesVendidas).toBe(24);
    expect(c.porMetodo).toEqual({ efectivo: { ventas: 1, totalBs: 23 }, qr: { ventas: 1, totalBs: 17 } });
  });

  test('día sin ventas devuelve ceros', () => {
    expect(cierreDiario([], '2026-10-15')).toMatchObject({ totalBs: 0, margenPorcentaje: 0, ticketPromedioBs: 0 });
  });
});

describe('API de ticket y cierre', () => {
  test('GET /ventas/:n/ticket y /ventas/cierre', async () => {
    const app = createApp();
    await request(app).post('/productos').send({ nombre: 'Loratadina 10mg', codigo: 'LOR10', precioVenta: 2 });
    await request(app).post('/productos/1/lotes')
      .send({ numero: 'L-1', vencimiento: '2027-09-30', cantidad: 20, costoUnitario: 0.8 });
    await request(app).post('/ventas')
      .send({ items: [{ productoId: 1, cantidad: 5 }], montoRecibido: 20, fecha: '2026-10-15' });

    const ticket = await request(app).get('/ventas/1/ticket');
    expect(ticket.status).toBe(200);
    expect(ticket.headers['content-type']).toMatch(/text\/plain/);
    expect(ticket.text).toMatch(/Cambio\s+Bs 10\.00/);

    const cierre = await request(app).get('/ventas/cierre?fecha=2026-10-15');
    expect(cierre.body).toMatchObject({ totalBs: 10, costoBs: 4, margenBs: 6, cantidadVentas: 1 });
  });
});
