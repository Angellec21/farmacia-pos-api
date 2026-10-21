const fs = require('fs');
const path = require('path');

const VERSION_FORMATO = 1;
const SERVICIOS = ['usuarios', 'inventario', 'proveedores', 'compras', 'ventas'];

/**
 * Guarda y carga el estado completo de la farmacia en un archivo JSON.
 * La escritura es atómica (archivo temporal + rename), así un corte de luz
 * a mitad del guardado nunca deja el archivo a medias.
 */
function crearAlmacen(ruta) {
  const destino = path.resolve(ruta);

  function existe() {
    return fs.existsSync(destino);
  }

  /** Devuelve el estado guardado o null si todavía no hay archivo. */
  function leer() {
    if (!existe()) return null;
    let datos;
    try {
      datos = JSON.parse(fs.readFileSync(destino, 'utf8'));
    } catch (err) {
      throw new Error(`No se pudo leer ${destino}: ${err.message}`);
    }
    if (datos.version !== VERSION_FORMATO) {
      throw new Error(`Formato de datos no soportado (versión ${datos.version}) en ${destino}`);
    }
    return datos;
  }

  function escribir(estado) {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const temporal = `${destino}.${process.pid}.tmp`;
    const contenido = JSON.stringify({ version: VERSION_FORMATO, guardadoEn: new Date().toISOString(), ...estado }, null, 2);
    fs.writeFileSync(temporal, contenido, { mode: 0o600 });
    fs.renameSync(temporal, destino);
  }

  return { ruta: destino, existe, leer, escribir };
}

/** Toma una foto del estado de todos los servicios. */
function exportarEstado(servicios) {
  const estado = {};
  for (const nombre of SERVICIOS) estado[nombre] = servicios[nombre].exportar();
  return estado;
}

/** Restaura en los servicios un estado exportado (los que falten quedan vacíos). */
function importarEstado(servicios, estado) {
  for (const nombre of SERVICIOS) {
    if (estado[nombre]) servicios[nombre].importar(estado[nombre]);
  }
}

module.exports = { crearAlmacen, exportarEstado, importarEstado, SERVICIOS };
