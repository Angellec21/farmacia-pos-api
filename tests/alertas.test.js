const request = require('supertest');
const { createApp } = require('../src/app');
const { crearInventario } = require('../src/services/inventario');
const { lotesPorVencer, stockBajo, diasEntre } = require('../src/services/alertas');

function escenario() {
  const inv = crearInventario();
  const a = inv.crearProducto({ nombre: 'Jarabe tos', codigo: 'JAR1', precioVenta: 25, stockMinimo: 5 });
  const b = inv.crearProducto({ nombre: 'Omeprazol', codigo: 'OME20', precioVenta: 1, stockMinimo: 100 });
  inv.agregarLote(a.id, { numero: 'J-VENC', vencimiento: '2026-09-30', cantidad: 4, costoUnitario: 15 });
  inv.agregarLote(a.id, { numero: 'J-PRONTO', vencimiento: '2026-10-20', cantidad: 6, costoUnitario: 16 });
  inv.agregarLote(b.id, { numero: 'O-LEJOS', vencimiento: '2027-08-01', cantidad: 40, costoUnitario: 0.5 });
  return inv;
}

describe('alertas', () => {
  test('diasEntre cuenta días calendario', () => {
    expect(diasEntre('2026-10-08', '2026-10-20')).toBe(12);
    expect(diasEntre('2026-10-08', '2026-09-30')).toBe(-8);
  });

  test('lista vencidos y por vencer con valor en riesgo en Bs', () => {
    const r = lotesPorVencer(escenario().listar(), { hoy: '2026-10-08', dias: 30 });
    expect(r.lotes.map((l) => [l.lote, l.estado])).toEqual([['J-VENC', 'vencido'], ['J-PRONTO', 'por_vencer']]);
    expect(r.valorTotalEnRiesgoBs).toBe(156); // 4*15 + 6*16
  });

  test('lotes lejanos no aparecen', () => {
    const r = lotesPorVencer(escenario().listar(), { hoy: '2026-10-08', dias: 30 });
    expect(r.lotes.find((l) => l.lote === 'O-LEJOS')).toBeUndefined();
  });

  test('stock bajo ignora lotes vencidos y ordena por faltante', () => {
    const r = stockBajo(escenario().listar(), { hoy: '2026-10-08' });
    expect(r.map((x) => [x.codigo, x.stockVigente, x.faltan])).toEqual([['OME20', 40, 60]]);
    const r2 = stockBajo(escenario().listar(), { hoy: '2026-10-25' });
    expect(r2.map((x) => x.codigo)).toEqual(['OME20', 'JAR1']);
  });

  test('GET /alertas/vencimientos y /alertas/stock-bajo', async () => {
    const app = createApp({ inventario: escenario() });
    const v = await request(app).get('/alertas/vencimientos?dias=15&hoy=2026-10-08');
    expect(v.status).toBe(200);
    expect(v.body.total).toBe(2);
    const s = await request(app).get('/alertas/stock-bajo?hoy=2026-10-08');
    expect(s.body[0].codigo).toBe('OME20');
  });

  test('dias inválido responde 400', async () => {
    const res = await request(createApp()).get('/alertas/vencimientos?dias=-3');
    expect(res.status).toBe(400);
  });

  test('sin productos no hay alertas', async () => {
    const res = await request(createApp()).get('/alertas/vencimientos');
    expect(res.body.total).toBe(0);
    expect(res.body.valorTotalEnRiesgoBs).toBe(0);
  });
});
