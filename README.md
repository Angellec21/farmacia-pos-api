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

*(La tabla crece con cada avance del proyecto.)*

## Roadmap

- [x] Estructura Express + Jest
- [ ] Productos con lotes y descuento FEFO
- [ ] Alertas de vencimiento y stock mínimo
- [ ] Ventas con ticket
- [ ] Proveedores y compras
- [ ] Autenticación JWT con roles admin / cajero
- [ ] Reportes para el dueño

## Licencia

MIT
