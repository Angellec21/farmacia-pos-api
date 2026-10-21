const fs = require('fs');
const os = require('os');
const path = require('path');
const { crearAlmacen, exportarEstado, importarEstado } = require('../src/persistencia');
const { crearServicios } = require('../src/servicios');
const { crearAppDePrueba } = require('./helpers/sesion');

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'farmacia-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function poblar(s) {
  s.usuarios.crear({ usuario: 'rosa', nombre: 'Rosa Gutiérrez', password: 'clave-admin-1', rol: 'admin' });
  const prov = s.proveedores.crear({ nombre: 'Droguería INTI', nit: '1020304025', diasCredito: 30 });
  const p = s.inventario.crearProducto({ nombre: 'Paracetamol 500 mg', codigo: 'PAR500', precioVenta: 1.5, stockMinimo: 20 });
  s.compras.registrar({
    proveedorId: prov.id,
    numeroFactura: 'F-100',
    fecha: '2026-10-01',
    condicion: 'credito',
    items: [{ productoId: p.id, lote: 'L1', vencimiento: '2027-06-30', cantidad: 100, costoUnitario: 0.8 }],
  });
  s.ventas.registrar({ items: [{ productoId: p.id, cantidad: 10 }], fecha: '2026-10-02' });
  return p;
}

describe('almacén en archivo JSON', () => {
  test('sin archivo, leer devuelve null', () => {
    const almacen = crearAlmacen(path.join(dir, 'no-existe.json'));
    expect(almacen.existe()).toBe(false);
    expect(almacen.leer()).toBeNull();
  });

  test('guarda y restaura todo el estado, incluidos los contadores', () => {
    const origen = crearServicios();
    const p = poblar(origen);
    const almacen = crearAlmacen(path.join(dir, 'sub', 'farmacia.json'));
    almacen.escribir(exportarEstado(origen));

    const copia = crearServicios();
    importarEstado(copia, almacen.leer());
    expect(copia.inventario.obtener(p.id).stock).toBe(90);
    expect(copia.ventas.listar()).toHaveLength(1);
    expect(copia.compras.cuentasPorPagar('2026-10-05').totalPorPagar).toBe(80);
    expect(copia.usuarios.verificarCredenciales('rosa', 'clave-admin-1')).not.toBeNull();

    // Los números siguientes continúan donde se quedaron
    const otro = copia.inventario.crearProducto({ nombre: 'Ibuprofeno 400 mg', codigo: 'IBU400', precioVenta: 2 });
    expect(otro.id).toBe(p.id + 1);
    expect(copia.ventas.registrar({ items: [{ productoId: p.id, cantidad: 1 }], fecha: '2026-10-03' }).numero).toBe(2);
  });

  test('el archivo nunca contiene contraseñas en texto plano y no deja temporales', () => {
    const s = crearServicios();
    poblar(s);
    const ruta = path.join(dir, 'farmacia.json');
    crearAlmacen(ruta).escribir(exportarEstado(s));
    expect(fs.readFileSync(ruta, 'utf8')).not.toContain('clave-admin-1');
    expect(fs.readdirSync(dir)).toEqual(['farmacia.json']);
  });

  test('la copia importada es independiente del estado original', () => {
    const s = crearServicios();
    const p = poblar(s);
    const estado = exportarEstado(s);
    const copia = crearServicios();
    importarEstado(copia, estado);
    copia.ventas.registrar({ items: [{ productoId: p.id, cantidad: 5 }], fecha: '2026-10-03' });
    expect(s.inventario.obtener(p.id).stock).toBe(90);
    expect(estado.inventario.productos[0].lotes[0].cantidad).toBe(90);
  });

  test('rechaza un archivo dañado o de otra versión con un mensaje claro', () => {
    const ruta = path.join(dir, 'farmacia.json');
    fs.writeFileSync(ruta, '{ roto');
    expect(() => crearAlmacen(ruta).leer()).toThrow(/No se pudo leer/);
    fs.writeFileSync(ruta, JSON.stringify({ version: 99 }));
    expect(() => crearAlmacen(ruta).leer()).toThrow(/no soportado/);
  });
});

describe('guardado automático desde la API', () => {
  async function appConAlmacen() {
    const servicios = crearServicios();
    const almacen = crearAlmacen(path.join(dir, 'farmacia.json'));
    const sesion = await crearAppDePrueba({ ...servicios, almacen });
    return { ...sesion, almacen };
  }

  test('una operación exitosa que modifica datos se guarda en disco', async () => {
    const { admin, almacen } = await appConAlmacen();
    const res = await admin
      .post('/productos')
      .send({ nombre: 'Amoxicilina 500 mg', codigo: 'AMX500', precioVenta: 3.5, stockMinimo: 10 });
    expect(res.status).toBe(201);
    const guardado = almacen.leer();
    expect(guardado.inventario.productos.map((p) => p.codigo)).toEqual(['AMX500']);
  });

  test('las consultas y las operaciones rechazadas no escriben', async () => {
    const { admin, cajero, almacen } = await appConAlmacen();
    await admin.get('/productos');
    await admin.post('/productos').send({ nombre: 'Sin precio', codigo: 'X1' });
    await cajero.post('/productos').send({ nombre: 'No permitido', codigo: 'X2', precioVenta: 1 });
    expect(almacen.existe()).toBe(false);
  });

  test('si falla el guardado se registra el error y la API sigue respondiendo', async () => {
    const errores = [];
    const almacen = { escribir: () => { throw new Error('disco lleno'); } };
    const { admin } = await crearAppDePrueba({ ...crearServicios(), almacen, registrarError: (m) => errores.push(m) });
    const res = await admin.post('/productos').send({ nombre: 'Loratadina 10 mg', codigo: 'LOR10', precioVenta: 2 });
    expect(res.status).toBe(201);
    expect(errores[0]).toMatch(/disco lleno/);
  });
});
