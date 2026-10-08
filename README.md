# farmacia-pos-api

API REST para farmacias pequeñas y medianas: productos con **lotes y fechas de vencimiento**, salida de stock **FEFO** (primero en vencer, primero en salir), alertas de vencimiento y stock mínimo, ventas y roles.

Hecha con **Node.js + Express**, probada con **Jest + Supertest**.

## Problema que resuelve

En una farmacia el mismo producto llega en varios lotes con fechas de vencimiento distintas. Si se vende "cualquier" lote, los más antiguos se vencen en el estante y se pierde dinero. Esta API:

- Registra cada lote con su costo y vencimiento.
- Descuenta stock siempre del lote que vence primero (FEFO).
- Avisa qué lotes están por vencer y cuánto dinero (en Bs) está en riesgo.
- Avisa qué productos están por debajo del stock mínimo.

## Uso

```bash
npm install
npm test
npm start   # http://localhost:3000
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio |
| GET | `/productos` | Lista productos con su stock total |
| POST | `/productos` | Crea producto (`nombre`, `codigo`, `precioVenta`, `stockMinimo`) |
| GET | `/productos/:id` | Detalle con lotes ordenados por vencimiento |
| POST | `/productos/:id/lotes` | Registra lote (`numero`, `vencimiento` AAAA-MM-DD, `cantidad`, `costoUnitario`) |
| POST | `/productos/:id/salidas` | Descuenta stock por FEFO (`cantidad`, `fecha` opcional) |
| GET | `/alertas/vencimientos?dias=30` | Lotes vencidos o por vencer y valor en riesgo (Bs) |
| GET | `/alertas/stock-bajo` | Productos con stock vigente en o bajo el mínimo |

### Ejemplo: salida FEFO

```bash
curl -X POST localhost:3000/productos/1/salidas \
  -H 'Content-Type: application/json' -d '{"cantidad": 40}'
```

```json
{
  "usados": [
    { "lote": "L-A", "vencimiento": "2026-12-31", "cantidad": 30, "costoUnitario": 0.7 },
    { "lote": "L-B", "vencimiento": "2027-06-30", "cantidad": 10, "costoUnitario": 0.8 }
  ],
  "costoTotal": 29
}
```

Los lotes vencidos nunca se usan en una salida.

*(La tabla crece con cada avance del proyecto.)*

## Roadmap

- [x] Estructura Express + Jest
- [x] Productos con lotes y descuento FEFO
- [x] Alertas de vencimiento y stock mínimo
- [ ] Ventas con ticket
- [ ] Proveedores y compras
- [ ] Autenticación JWT con roles admin / cajero
- [ ] Reportes para el dueño

## Licencia

MIT
