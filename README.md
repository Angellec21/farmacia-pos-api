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
| POST | `/ventas` | Registra venta (`items[]`, `metodoPago` efectivo/qr/tarjeta, `cliente`, `nit`, `montoRecibido`) |
| GET | `/ventas?fecha=AAAA-MM-DD` | Lista ventas (opcionalmente de un día) |
| GET | `/ventas/:numero` | Detalle con lotes usados por ítem |
| GET | `/ventas/:numero/ticket` | Ticket en texto para impresora térmica de 58 mm |
| GET | `/ventas/cierre?fecha=AAAA-MM-DD` | Cierre de caja: total, margen en Bs y %, ticket promedio, totales por método de pago |

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

### Ejemplo: venta y ticket

Una venta es **todo o nada**: si falta stock de un solo producto, no se descuenta nada.

```bash
curl -X POST localhost:3000/ventas -H 'Content-Type: application/json' \
  -d '{"items":[{"productoId":1,"cantidad":10}],"cliente":"Juan Pérez","nit":"7894561","montoRecibido":20}'
curl localhost:3000/ventas/1/ticket
```

```
      FARMACIA SAN MARTIN
  Av. Banzer 3er anillo - SCZ
--------------------------------
Venta Nro: 1
...
TOTAL                   Bs 15.00
Cambio                   Bs 5.00
```

Los datos del negocio del ticket se configuran con las variables `FARMACIA_NOMBRE`, `FARMACIA_DIRECCION` y `FARMACIA_NIT`.

## Arquitectura

```
src/
  app.js            # arma la app Express (inyección de servicios para tests)
  routes/           # capa HTTP: valida query/params y delega
  services/
    inventario.js   # productos, lotes y descuento FEFO
    alertas.js      # vencimientos y stock mínimo
    ventas.js       # ventas todo-o-nada con trazabilidad de lotes
    reportes.js     # ticket térmico y cierre diario
tests/              # Jest + Supertest (servicios y API)
```

Los datos se guardan en memoria; la persistencia (SQLite) está en el roadmap.

*(La tabla crece con cada avance del proyecto.)*

## Roadmap

- [x] Estructura Express + Jest
- [x] Productos con lotes y descuento FEFO
- [x] Alertas de vencimiento y stock mínimo
- [x] Ventas con ticket y cierre diario
- [ ] Proveedores y compras
- [ ] Autenticación JWT con roles admin / cajero
- [ ] Reportes para el dueño (más vendidos, margen por producto)
- [ ] Persistencia en SQLite y datos de ejemplo de Santa Cruz

## Licencia

MIT
