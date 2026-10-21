#!/usr/bin/env node
/**
 * Crea un archivo de datos con una farmacia de ejemplo de Santa Cruz.
 * Uso: npm run seed            (no sobrescribe datos existentes)
 *      npm run seed -- --forzar (reemplaza el archivo actual)
 */
const { crearServicios } = require('../src/servicios');
const { crearAlmacen, exportarEstado } = require('../src/persistencia');
const { cargarDatosDeEjemplo } = require('../src/datos-ejemplo');

const almacen = crearAlmacen(process.env.DATA_FILE || 'data/farmacia.json');
if (almacen.existe() && !process.argv.includes('--forzar')) {
  console.error(`Ya existe ${almacen.ruta}. Use "npm run seed -- --forzar" para reemplazarlo.`);
  process.exit(1);
}

const servicios = crearServicios();
const { credenciales, resumen } = cargarDatosDeEjemplo(servicios);
almacen.escribir(exportarEstado(servicios));

console.log(`Datos de ejemplo guardados en ${almacen.ruta}`);
console.log(`  ${resumen.productos} productos, ${resumen.proveedores} proveedores, ${resumen.compras} compras, ${resumen.ventas} ventas`);
console.log('Usuarios (contraseñas aleatorias, se muestran solo esta vez):');
for (const c of credenciales) console.log(`  ${c.rol.padEnd(6)} ${c.usuario.padEnd(6)} ${c.password}`);
