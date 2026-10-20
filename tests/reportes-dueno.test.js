const {
  masVendidos,
  margenPorProducto,
  ventasPorCajero,
  validarPeriodo,
} = require('../src/services/reportes');

const rosa = { id: 1, nombre: 'Rosa Gutiérrez' };
const luis = { id: 2, nombre: 'Luis Vaca' };

const item = (productoId, producto, cantidad, precio, costoUnit) => ({
  productoId,
  producto,
  codigo: `P${productoId}`,
  cantidad,
  precioUnitario: precio,
  subtotal: cantidad * precio,
  costo: cantidad * costoUnit,
});

const venta = (numero, fecha, cajero, metodoPago, items) => ({
  numero,
  fecha,
  cajero,
  metodoPago,
  items,
  total: items.reduce((s, i) => s + i.subtotal, 0),
});

// Paracetamol: Bs 1.50 (costo 0.60) · Amoxicilina: Bs 3.00 (costo 2.40) · Suero oral: Bs 4.00 (costo 2.00)
const ventas = [
  venta(1, '2026-10-01', luis, 'efectivo', [item(1, 'Paracetamol 500mg', 20, 1.5, 0.6), item(3, 'Suero oral', 2, 4, 2)]),
  venta(2, '2026-10-02', luis, 'qr', [item(2, 'Amoxicilina 500mg', 21, 3, 2.4)]),
  venta(3, '2026-10-02', rosa, 'efectivo', [item(1, 'Paracetamol 500mg', 10, 1.5, 0.6)]),
  venta(4, '2026-10-10', rosa, 'tarjeta', [item(3, 'Suero oral', 5, 4, 2)]),
];

describe('más vendidos', () => {
  test('ordena por unidades con puesto y participación en ingresos', () => {
    const r = masVendidos(ventas);
    expect(r.map((f) => f.producto)).toEqual(['Paracetamol 500mg', 'Amoxicilina 500mg', 'Suero oral']);
    expect(r[0]).toMatchObject({ puesto: 1, unidades: 30, ingresosBs: 45 });
    // total del periodo: 45 + 63 + 28 = 136
    expect(r[1].participacion).toBe(46.32);
    expect(r[0]).not.toHaveProperty('costoBs');
  });

  test('puede ordenar por ingresos, filtrar periodo y limitar', () => {
    const r = masVendidos(ventas, { orden: 'ingresos', limite: 1 });
    expect(r).toHaveLength(1);
    expect(r[0].producto).toBe('Amoxicilina 500mg');

    const octubre2 = masVendidos(ventas, { desde: '2026-10-02', hasta: '2026-10-02' });
    expect(octubre2.map((f) => [f.producto, f.unidades])).toEqual([
      ['Amoxicilina 500mg', 21],
      ['Paracetamol 500mg', 10],
    ]);
  });
});

describe('margen por producto', () => {
  test('muestra primero el producto que menos margen deja', () => {
    const r = margenPorProducto(ventas);
    expect(r.map((f) => [f.producto, f.margenPorcentaje])).toEqual([
      ['Amoxicilina 500mg', 20],
      ['Suero oral', 50],
      ['Paracetamol 500mg', 60],
    ]);
    expect(r[0]).toMatchObject({ ingresosBs: 63, costoBs: 50.4, margenBs: 12.6 });
  });

  test('periodo sin ventas devuelve lista vacía', () => {
    expect(margenPorProducto(ventas, { desde: '2026-11-01' })).toEqual([]);
  });
});

describe('ventas por cajero', () => {
  test('total, ticket promedio y desglose por método de pago', () => {
    const r = ventasPorCajero(ventas);
    expect(r).toEqual([
      {
        cajeroId: 2,
        cajero: 'Luis Vaca',
        ventas: 2,
        unidades: 43,
        totalBs: 101,
        ticketPromedioBs: 50.5,
        porMetodo: { efectivo: 38, qr: 63 },
      },
      {
        cajeroId: 1,
        cajero: 'Rosa Gutiérrez',
        ventas: 2,
        unidades: 15,
        totalBs: 35,
        ticketPromedioBs: 17.5,
        porMetodo: { efectivo: 15, tarjeta: 20 },
      },
    ]);
  });
});

describe('validación de periodo', () => {
  test('acepta fechas válidas y rechaza formato o rango incorrecto', () => {
    expect(validarPeriodo({ desde: '2026-10-01', hasta: '2026-10-31' })).toBeNull();
    expect(validarPeriodo({})).toBeNull();
    expect(validarPeriodo({ desde: '01/10/2026' })).toMatch(/desde/);
    expect(validarPeriodo({ desde: '2026-10-31', hasta: '2026-10-01' })).toMatch(/posterior/);
  });
});
