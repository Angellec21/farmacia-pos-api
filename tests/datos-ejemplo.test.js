const request = require('supertest');
const { createApp } = require('../src/app');
const { crearServicios } = require('../src/servicios');
const { cargarDatosDeEjemplo } = require('../src/datos-ejemplo');
const { lotesPorVencer, stockBajo } = require('../src/services/alertas');
const { masVendidos } = require('../src/services/reportes');

const HOY = '2026-10-21';

function farmaciaDeEjemplo() {
  const servicios = crearServicios();
  const resultado = cargarDatosDeEjemplo(servicios, { hoy: HOY, passwords: { admin: 'clave-demo-admin', luis: 'clave-demo-luis' } });
  return { servicios, ...resultado };
}

describe('datos de ejemplo de Santa Cruz', () => {
  test('crea productos, proveedores, compras, ventas y tres usuarios', () => {
    const { resumen, credenciales } = farmaciaDeEjemplo();
    expect(resumen).toEqual({ productos: 10, proveedores: 3, compras: 4, ventas: expect.any(Number) });
    expect(resumen.ventas).toBeGreaterThan(20);
    expect(credenciales.map((c) => `${c.usuario}:${c.rol}`)).toEqual(['admin:admin', 'luis:cajero', 'carla:cajero']);
  });

  test('las contraseñas no indicadas se generan aleatorias', () => {
    const { credenciales } = farmaciaDeEjemplo();
    const carla = credenciales.find((c) => c.usuario === 'carla');
    expect(carla.password).toHaveLength(12);
    expect(farmaciaDeEjemplo().credenciales[2].password).not.toBe(carla.password);
  });

  test('siempre hay alertas que mostrar: lote vencido, por vencer y stock bajo', () => {
    const { servicios } = farmaciaDeEjemplo();
    const productos = servicios.inventario.listar();
    const { lotes } = lotesPorVencer(productos, { hoy: HOY, dias: 30 });
    expect(lotes.some((l) => l.estado === 'vencido')).toBe(true);
    expect(lotes.some((l) => l.estado === 'por_vencer')).toBe(true);
    expect(stockBajo(productos, { hoy: HOY }).length).toBeGreaterThan(0);
  });

  test('hay deudas con droguerías y el abono parcial se refleja', () => {
    const { servicios } = farmaciaDeEjemplo();
    const cxp = servicios.compras.cuentasPorPagar(HOY);
    expect(cxp.facturas).toHaveLength(3); // la compra al contado no genera deuda
    expect(servicios.compras.obtener(1).pagos).toEqual([{ fecha: '2026-09-21', monto: 300 }]);
  });

  test('las ventas nunca usan lotes vencidos y alimentan el reporte de más vendidos', () => {
    const { servicios } = farmaciaDeEjemplo();
    for (const v of servicios.ventas.listar()) {
      for (const it of v.items) for (const l of it.lotes) expect(l.vencimiento >= v.fecha).toBe(true);
    }
    const top = masVendidos(servicios.ventas.listar(), { limite: 1 });
    expect(top[0].producto).toMatch(/Paracetamol/);
  });

  test('solo se cargan en una farmacia vacía', () => {
    const { servicios } = farmaciaDeEjemplo();
    expect(() => cargarDatosDeEjemplo(servicios, { hoy: HOY })).toThrow(/vacía/);
  });

  test('los usuarios de ejemplo pueden iniciar sesión en la API', async () => {
    const { servicios } = farmaciaDeEjemplo();
    const app = createApp({ ...servicios, jwtSecret: 'secreto-de-pruebas' });
    const res = await request(app).post('/auth/login').send({ usuario: 'luis', password: 'clave-demo-luis' });
    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('cajero');
  });
});
