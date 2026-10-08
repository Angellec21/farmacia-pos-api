const { redondear } = require('./inventario');

const MS_DIA = 24 * 60 * 60 * 1000;

function diasEntre(desde, hasta) {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / MS_DIA);
}

/**
 * Lotes vencidos o que vencen dentro de `dias` días a partir de `hoy`.
 * Incluye el valor en riesgo (cantidad * costoUnitario) en Bs.
 */
function lotesPorVencer(productos, { hoy, dias = 30 }) {
  const lotes = [];
  for (const p of productos) {
    for (const l of p.lotes) {
      const restantes = diasEntre(hoy, l.vencimiento);
      if (restantes > dias) continue;
      lotes.push({
        productoId: p.id,
        producto: p.nombre,
        lote: l.numero,
        vencimiento: l.vencimiento,
        diasRestantes: restantes,
        estado: restantes < 0 ? 'vencido' : 'por_vencer',
        cantidad: l.cantidad,
        valorEnRiesgoBs: redondear(l.cantidad * l.costoUnitario),
      });
    }
  }
  lotes.sort((a, b) => a.diasRestantes - b.diasRestantes);
  const valorTotalEnRiesgoBs = redondear(lotes.reduce((s, l) => s + l.valorEnRiesgoBs, 0));
  return { hoy, dias, total: lotes.length, valorTotalEnRiesgoBs, lotes };
}

/** Productos cuyo stock vigente está en o por debajo del mínimo. */
function stockBajo(productos, { hoy }) {
  return productos
    .map((p) => {
      const vigente = p.lotes.filter((l) => l.vencimiento >= hoy).reduce((s, l) => s + l.cantidad, 0);
      return {
        productoId: p.id,
        producto: p.nombre,
        codigo: p.codigo,
        stockVigente: vigente,
        stockMinimo: p.stockMinimo,
        faltan: Math.max(p.stockMinimo - vigente, 0),
      };
    })
    .filter((r) => r.stockMinimo > 0 && r.stockVigente <= r.stockMinimo)
    .sort((a, b) => b.faltan - a.faltan);
}

module.exports = { lotesPorVencer, stockBajo, diasEntre };
