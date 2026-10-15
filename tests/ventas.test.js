const { crearInventario } = require('../src/services/inventario');
const { crearVentas } = require('../src/services/ventas');

function preparar() {
  const inv = crearInventario();
  inv.crearProducto({ nombre: 'Paracetamol 500mg', codigo: 'PAR500', precioVenta: 1.5, stockMinimo: 50 });
  inv.crearProducto({ nombre: 'Ibuprofeno 400mg', codigo: 'IBU400', precioVenta: 2, stockMinimo: 30 });
  inv.agregarLote(1, { numero: 'P-01', vencimiento: '2026-12-31', cantidad: 10, costoUnitario: 0.6 });
  inv.agregarLote(1, { numero: 'P-02', vencimiento: '2027-08-31', cantidad: 50, costoUnitario: 0.7 });
  inv.agregarLote(2, { numero: 'I-01', vencimiento: '2027-05-31', cantidad: 20, costoUnitario: 1.1 });
  return { inv, ventas: crearVentas(inv) };
}

describe('servicio de ventas', () => {
  test('registra venta con total, costo, margen y lotes usados (FEFO)', () => {
    const { ventas } = preparar();
    const v = ventas.registrar({
      items: [{ productoId: 1, cantidad: 12 }, { productoId: 2, cantidad: 3 }],
      fecha: '2026-10-15',
    });
    expect(v.numero).toBe(1);
    expect(v.total).toBe(24); // 12*1.5 + 3*2
    expect(v.costo).toBe(10.7); // 10*0.6 + 2*0.7 + 3*1.1
    expect(v.margen).toBe(13.3);
    expect(v.items[0].lotes).toEqual([
      { lote: 'P-01', vencimiento: '2026-12-31', cantidad: 10 },
      { lote: 'P-02', vencimiento: '2027-08-31', cantidad: 2 },
    ]);
    expect(v.cliente).toBe('Sin nombre');
    expect(v.nit).toBe('0');
  });

  test('es todo o nada: si falta stock de un producto no descuenta ninguno', () => {
    const { inv, ventas } = preparar();
    expect(() => ventas.registrar({
      items: [{ productoId: 1, cantidad: 5 }, { productoId: 2, cantidad: 99 }],
      fecha: '2026-10-15',
    })).toThrow(/Ibuprofeno/);
    expect(inv.obtener(1).stock).toBe(60);
    expect(inv.obtener(2).stock).toBe(20);
    expect(ventas.listar()).toHaveLength(0);
  });

  test('agrupa productos repetidos al verificar stock', () => {
    const { ventas } = preparar();
    expect(() => ventas.registrar({
      items: [{ productoId: 2, cantidad: 15 }, { productoId: 2, cantidad: 10 }],
      fecha: '2026-10-15',
    })).toThrow(/hay 20, se piden 25/);
  });

  test('no vende lotes vencidos', () => {
    const { ventas } = preparar();
    const v = ventas.registrar({ items: [{ productoId: 1, cantidad: 5 }], fecha: '2027-01-10' });
    expect(v.items[0].lotes[0].lote).toBe('P-02');
  });

  test('calcula el cambio en efectivo y rechaza monto insuficiente sin tocar stock', () => {
    const { inv, ventas } = preparar();
    const v = ventas.registrar({ items: [{ productoId: 2, cantidad: 3 }], montoRecibido: 10, fecha: '2026-10-15' });
    expect(v.cambio).toBe(4);
    expect(() => ventas.registrar({ items: [{ productoId: 2, cantidad: 3 }], montoRecibido: 5, fecha: '2026-10-15' }))
      .toThrow(/menor al total/);
    expect(inv.obtener(2).stock).toBe(17);
  });

  test('valida items y método de pago', () => {
    const { ventas } = preparar();
    expect(() => ventas.registrar({ items: [] })).toThrow(/items/);
    expect(() => ventas.registrar({ items: [{ productoId: 1, cantidad: 0 }] })).toThrow(/cantidad/);
    expect(() => ventas.registrar({ items: [{ productoId: 1, cantidad: 1 }], metodoPago: 'cheque' })).toThrow(/metodoPago/);
  });

  test('filtra ventas por fecha', () => {
    const { ventas } = preparar();
    ventas.registrar({ items: [{ productoId: 1, cantidad: 1 }], fecha: '2026-10-14' });
    ventas.registrar({ items: [{ productoId: 1, cantidad: 1 }], fecha: '2026-10-15' });
    expect(ventas.listar({ fecha: '2026-10-15' })).toHaveLength(1);
    expect(ventas.obtener(2).fecha).toBe('2026-10-15');
    expect(() => ventas.obtener(9)).toThrow(/no encontrada/);
  });
});
