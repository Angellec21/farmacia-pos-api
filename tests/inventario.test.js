const { crearInventario } = require('../src/services/inventario');

function inventarioConParacetamol() {
  const inv = crearInventario();
  const p = inv.crearProducto({ nombre: 'Paracetamol 500mg', codigo: 'PAR500', precioVenta: 1.5, stockMinimo: 20 });
  inv.agregarLote(p.id, { numero: 'L-B', vencimiento: '2027-06-30', cantidad: 50, costoUnitario: 0.8 });
  inv.agregarLote(p.id, { numero: 'L-A', vencimiento: '2026-12-31', cantidad: 30, costoUnitario: 0.7 });
  return { inv, id: p.id };
}

describe('inventario por lotes', () => {
  test('crea producto con stock 0', () => {
    const inv = crearInventario();
    const p = inv.crearProducto({ nombre: 'Ibuprofeno', codigo: 'IBU400', precioVenta: 2 });
    expect(p.id).toBe(1);
    expect(p.stock).toBe(0);
  });

  test('rechaza código duplicado', () => {
    const inv = crearInventario();
    inv.crearProducto({ nombre: 'A', codigo: 'X1', precioVenta: 1 });
    expect(() => inv.crearProducto({ nombre: 'B', codigo: 'X1', precioVenta: 1 })).toThrow('Ya existe');
  });

  test('rechaza precio inválido', () => {
    const inv = crearInventario();
    expect(() => inv.crearProducto({ nombre: 'A', codigo: 'X', precioVenta: 0 })).toThrow('precioVenta');
  });

  test('ordena lotes por vencimiento y suma el stock', () => {
    const { inv, id } = inventarioConParacetamol();
    const p = inv.obtener(id);
    expect(p.lotes.map((l) => l.numero)).toEqual(['L-A', 'L-B']);
    expect(p.stock).toBe(80);
  });

  test('rechaza fecha de vencimiento mal escrita', () => {
    const { inv, id } = inventarioConParacetamol();
    expect(() => inv.agregarLote(id, { numero: 'L-C', vencimiento: '31/12/2026', cantidad: 1, costoUnitario: 1 }))
      .toThrow('AAAA-MM-DD');
  });

  test('FEFO: descuenta primero del lote que vence antes', () => {
    const { inv, id } = inventarioConParacetamol();
    const r = inv.descontar(id, 10, '2026-10-08');
    expect(r.usados).toEqual([{ lote: 'L-A', vencimiento: '2026-12-31', cantidad: 10, costoUnitario: 0.7 }]);
    expect(r.producto.stock).toBe(70);
  });

  test('FEFO: cruza al siguiente lote cuando el primero no alcanza', () => {
    const { inv, id } = inventarioConParacetamol();
    const r = inv.descontar(id, 40, '2026-10-08');
    expect(r.usados.map((u) => [u.lote, u.cantidad])).toEqual([['L-A', 30], ['L-B', 10]]);
    expect(r.costoTotal).toBe(29); // 30*0.7 + 10*0.8
    expect(r.producto.lotes.map((l) => l.numero)).toEqual(['L-B']);
  });

  test('no vende de lotes vencidos', () => {
    const { inv, id } = inventarioConParacetamol();
    expect(() => inv.descontar(id, 60, '2027-01-15')).toThrow('Stock vigente insuficiente: hay 50');
  });

  test('producto inexistente da 404', () => {
    const inv = crearInventario();
    expect(() => inv.obtener(99)).toThrow('Producto no encontrado');
  });
});
