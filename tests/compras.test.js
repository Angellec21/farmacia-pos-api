const { crearInventario } = require('../src/services/inventario');
const { crearProveedores } = require('../src/services/proveedores');
const { crearCompras } = require('../src/services/compras');

function escenario() {
  const inventario = crearInventario();
  const proveedores = crearProveedores();
  const compras = crearCompras(inventario, proveedores);
  inventario.crearProducto({ nombre: 'Paracetamol 500mg', codigo: 'PAR500', precioVenta: 1, stockMinimo: 50 });
  inventario.crearProducto({ nombre: 'Ibuprofeno 400mg', codigo: 'IBU400', precioVenta: 1.5 });
  proveedores.crear({ nombre: 'Droguería INTI - Santa Cruz', nit: '1020304025', telefono: '33461234', diasCredito: 30 });
  proveedores.crear({ nombre: 'Distribuidora Contado SRL', nit: '3344556', diasCredito: 0 });
  return { inventario, proveedores, compras };
}

const itemsBase = [
  { productoId: 1, lote: 'P-2401', vencimiento: '2027-08-31', cantidad: 200, costoUnitario: 0.45 },
  { productoId: 2, lote: 'I-0912', vencimiento: '2027-02-28', cantidad: 100, costoUnitario: 0.8 },
];

describe('proveedores', () => {
  test('valida NIT y evita duplicados', () => {
    const { proveedores } = escenario();
    expect(() => proveedores.crear({ nombre: 'X', nit: 'abc' })).toThrow(/nit/);
    expect(() => proveedores.crear({ nombre: 'Otra', nit: '1020304025' })).toThrow(/NIT/);
    expect(proveedores.listar()).toHaveLength(2);
  });
});

describe('compras', () => {
  test('compra al contado ingresa los lotes y no deja saldo', () => {
    const { compras, inventario } = escenario();
    const c = compras.registrar({ proveedorId: 1, numeroFactura: 'F-881', fecha: '2026-10-16', items: itemsBase });
    expect(c.total).toBe(170);
    expect(c.saldo).toBe(0);
    expect(inventario.obtener(1).stock).toBe(200);
    expect(inventario.obtener(2).lotes[0].numero).toBe('I-0912');
  });

  test('compra a crédito calcula fecha de pago con los días del proveedor', () => {
    const { compras } = escenario();
    const c = compras.registrar({
      proveedorId: 1, numeroFactura: 'F-882', fecha: '2026-10-16', condicion: 'credito', items: itemsBase,
    });
    expect(c.saldo).toBe(170);
    expect(c.vencePago).toBe('2026-11-15');
  });

  test('proveedor sin crédito no acepta compra a crédito', () => {
    const { compras } = escenario();
    expect(() => compras.registrar({
      proveedorId: 2, numeroFactura: '1', condicion: 'credito', items: itemsBase,
    })).toThrow(/no otorga crédito/);
  });

  test('es todo o nada: un ítem inválido no ingresa ningún lote', () => {
    const { compras, inventario } = escenario();
    const items = [itemsBase[0], { productoId: 99, lote: 'X', vencimiento: '2027-01-01', cantidad: 1, costoUnitario: 1 }];
    expect(() => compras.registrar({ proveedorId: 1, numeroFactura: 'F-1', items })).toThrow(/Producto no encontrado/);
    expect(inventario.obtener(1).stock).toBe(0);
    expect(compras.listar()).toHaveLength(0);
  });

  test('rechaza lote vencido, lote repetido y factura duplicada', () => {
    const { compras } = escenario();
    const vencido = [{ ...itemsBase[0], vencimiento: '2026-10-01' }];
    expect(() => compras.registrar({ proveedorId: 1, numeroFactura: 'A', fecha: '2026-10-16', items: vencido }))
      .toThrow(/vencido/);
    expect(() => compras.registrar({ proveedorId: 1, numeroFactura: 'B', items: [itemsBase[0], itemsBase[0]] }))
      .toThrow(/repetido/);
    compras.registrar({ proveedorId: 1, numeroFactura: 'C', fecha: '2026-10-16', items: [itemsBase[0]] });
    expect(() => compras.registrar({ proveedorId: 1, numeroFactura: 'C', items: [itemsBase[1]] }))
      .toThrow(/ya fue registrada/);
  });

  test('abonos reducen el saldo y no pueden excederlo', () => {
    const { compras } = escenario();
    compras.registrar({ proveedorId: 1, numeroFactura: 'F-9', fecha: '2026-10-16', condicion: 'credito', items: itemsBase });
    const c = compras.abonar(1, { monto: 100, fecha: '2026-10-20' });
    expect(c.saldo).toBe(70);
    expect(c.pagos).toEqual([{ fecha: '2026-10-20', monto: 100 }]);
    expect(() => compras.abonar(1, { monto: 70.01 })).toThrow(/supera el saldo/);
    expect(compras.abonar(1, { monto: 70 }).saldo).toBe(0);
    expect(() => compras.abonar(1, { monto: 1 })).toThrow(/no tiene saldo/);
  });

  test('cuentas por pagar marca facturas vencidas y totaliza por proveedor', () => {
    const { compras } = escenario();
    compras.registrar({ proveedorId: 1, numeroFactura: 'V1', fecha: '2026-09-01', condicion: 'credito', items: [itemsBase[0]] });
    compras.registrar({ proveedorId: 1, numeroFactura: 'V2', fecha: '2026-10-16', condicion: 'credito', items: [itemsBase[1]] });
    const cxp = compras.cuentasPorPagar('2026-10-16');
    expect(cxp.totalPorPagar).toBe(170);
    expect(cxp.totalVencido).toBe(90);
    expect(cxp.facturas[0]).toMatchObject({ numeroFactura: 'V1', estado: 'vencida', diasParaVencer: -15 });
    expect(cxp.facturas[1].estado).toBe('al dia');
    expect(cxp.porProveedor['Droguería INTI - Santa Cruz']).toBe(170);
  });
});
