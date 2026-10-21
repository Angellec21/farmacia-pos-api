# farmacia-pos-api

[![CI](https://github.com/Angellec21/farmacia-pos-api/actions/workflows/ci.yml/badge.svg)](https://github.com/Angellec21/farmacia-pos-api/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-20%20%7C%2022%20%7C%2024-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Jest](https://img.shields.io/badge/tests-Jest%20%2B%20Supertest-C21325?logo=jest&logoColor=white)
![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue)

API REST para farmacias pequeñas y medianas: productos con **lotes y fechas de vencimiento**, salida de stock **FEFO** (primero en vencer, primero en salir), alertas de vencimiento y stock mínimo, ventas y roles.

Hecha con **Node.js + Express**, probada con **Jest + Supertest**.

## Problema que resuelve

En una farmacia el mismo producto llega en varios lotes con fechas de vencimiento distintas. Si se vende "cualquier" lote, los más antiguos se vencen en el estante y se pierde dinero. Esta API:

- Registra cada lote con su costo y vencimiento.
- Descuenta stock siempre del lote que vence primero (FEFO).
- Avisa qué lotes están por vencer y cuánto dinero (en Bs) está en riesgo.
- Avisa qué productos están por debajo del stock mínimo.
- Registra las compras a droguerías y controla cuánto se les debe y qué facturas ya vencieron.
- Separa lo que puede hacer el **dueño/administrador** de lo que puede hacer el **cajero**: cada venta queda a nombre de quien la cobró y el cajero no ve costos ni márgenes.

## Uso

```bash
npm install
npm test               # 92 pruebas; `npm test -- --coverage` para ver la cobertura
cp .env.example .env   # opcional: cambie JWT_SECRET y ADMIN_PASSWORD
npm start              # http://localhost:3000
```

### Probar con datos de ejemplo

```bash
npm run seed   # crea data/farmacia.json con una farmacia de Santa Cruz
npm start
```

El script carga 10 productos de mostrador (paracetamol, amoxicilina, sales de rehidratación, repelente…), 3 droguerías ficticias con días de crédito, 4 compras (una ya con abono), una semana de ventas de dos cajeros y, a propósito, un lote vencido, lotes por vencer y productos bajo el stock mínimo, para que las alertas y reportes tengan algo que mostrar. Las fechas son relativas al día en que se ejecuta. Imprime los usuarios (`admin`, `luis`, `carla`) con contraseñas aleatorias. No sobrescribe datos existentes salvo con `npm run seed -- --forzar`.

Sin datos de ejemplo, al iniciar por primera vez se crea el administrador (`ADMIN_USUARIO` / `ADMIN_PASSWORD`). Si no define `ADMIN_PASSWORD`, se genera una contraseña temporal y se muestra en la consola.

## Autenticación y roles

Todas las rutas, salvo `/health` y `/auth/login`, requieren un token JWT:

```bash
TOKEN=$(curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"usuario":"admin","password":"cambie-esta-clave"}' | jq -r .token)
curl localhost:3000/productos -H "Authorization: Bearer $TOKEN"
```

| Acción | admin | cajero |
|--------|:-----:|:------:|
| Consultar productos y alertas | ✅ | ✅ |
| Registrar ventas, ver e imprimir **sus** tickets | ✅ | ✅ |
| Cierre de caja | todo el local, con margen | solo su caja, sin costos |
| Crear productos, ingresar lotes, salidas manuales | ✅ | ❌ |
| Proveedores, compras y cuentas por pagar | ✅ | ❌ |
| Reportes del dueño (más vendidos, márgenes, cajeros) | ✅ | ❌ |
| Crear y desactivar usuarios | ✅ | ❌ |

- Las contraseñas se guardan con **scrypt** y sal aleatoria, nunca en texto plano.
- El token dura `JWT_EXPIRA_EN` (8 h, un turno). Si el admin desactiva a un cajero, pierde el acceso al instante aunque su token siga vigente.
- El cajero de una venta se toma de la sesión, no del cuerpo de la petición.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio (público) |
| POST | `/auth/login` | Inicia sesión (`usuario`, `password`) y devuelve el token |
| GET | `/auth/yo` | Usuario de la sesión actual |
| GET / POST | `/usuarios` | Lista / crea usuario (`usuario`, `nombre`, `password`, `rol` admin/cajero) — admin |
| PATCH | `/usuarios/:id` | Activa o desactiva (`activo`) — admin |
| GET | `/productos` | Lista productos con su stock total |
| POST | `/productos` | Crea producto (`nombre`, `codigo`, `precioVenta`, `stockMinimo`) |
| GET | `/productos/:id` | Detalle con lotes ordenados por vencimiento |
| POST | `/productos/:id/lotes` | Registra lote (`numero`, `vencimiento` AAAA-MM-DD, `cantidad`, `costoUnitario`) |
| POST | `/productos/:id/salidas` | Descuenta stock por FEFO (`cantidad`, `fecha` opcional) |
| GET | `/alertas/vencimientos?dias=30` | Lotes vencidos o por vencer y valor en riesgo (Bs) |
| GET | `/alertas/stock-bajo` | Productos con stock vigente en o bajo el mínimo |
| POST | `/ventas` | Registra venta (`items[]`, `metodoPago` efectivo/qr/tarjeta, `cliente`, `nit`, `montoRecibido`) |
| GET | `/ventas?fecha=AAAA-MM-DD&cajeroId=` | Lista ventas (el cajero ve solo las suyas) |
| GET | `/ventas/:numero` | Detalle con lotes usados por ítem |
| GET | `/ventas/:numero/ticket` | Ticket en texto para impresora térmica de 58 mm |
| GET | `/ventas/cierre?fecha=AAAA-MM-DD&cajeroId=` | Cierre de caja: total, margen en Bs y %, ticket promedio, totales por método de pago |
| GET / POST | `/proveedores` | Lista / crea proveedor (`nombre`, `nit`, `telefono`, `diasCredito`) |
| GET | `/proveedores/:id/compras` | Historial de compras a un proveedor |
| POST | `/compras` | Registra compra e ingresa sus lotes (`proveedorId`, `numeroFactura`, `fecha`, `condicion` contado/credito, `items[]`) |
| GET | `/compras?proveedorId=&desde=&hasta=` | Lista compras con filtros |
| GET | `/compras/:numero` | Detalle de la compra con lotes y pagos |
| POST | `/compras/:numero/pagos` | Abono a una compra a crédito (`monto`, `fecha`) |
| GET | `/compras/cuentas-por-pagar?fecha=` | Saldos pendientes, facturas vencidas y total por proveedor (Bs) |
| GET | `/reportes/mas-vendidos?desde=&hasta=&orden=unidades\|ingresos&limite=10` | Ranking de productos con participación en ventas (%) — admin |
| GET | `/reportes/margen-productos?desde=&hasta=` | Margen bruto por producto con el costo real de los lotes, del menor al mayor — admin |
| GET | `/reportes/ventas-cajero?desde=&hasta=` | Ventas, total, ticket promedio y métodos de pago por cajero — admin |

> En los ejemplos siguientes se omite `-H "Authorization: Bearer $TOKEN"` por brevedad.

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

### Ejemplo: compra a crédito a una droguería

Una compra también es **todo o nada**: si un lote viene vencido, repetido o con un producto inexistente, no se ingresa ninguno.

```bash
curl -X POST localhost:3000/proveedores -H 'Content-Type: application/json' \
  -d '{"nombre":"Droguería INTI - Santa Cruz","nit":"1020304025","diasCredito":30}'
curl -X POST localhost:3000/compras -H 'Content-Type: application/json' -d '{
  "proveedorId": 1, "numeroFactura": "F-881", "fecha": "2026-10-16", "condicion": "credito",
  "items": [{"productoId":1,"lote":"P-2401","vencimiento":"2027-08-31","cantidad":200,"costoUnitario":0.45}]
}'
curl localhost:3000/compras/cuentas-por-pagar
```

```json
{
  "totalPorPagar": 90,
  "totalVencido": 0,
  "porProveedor": { "Droguería INTI - Santa Cruz": 90 },
  "facturas": [{ "numeroFactura": "F-881", "vencePago": "2026-11-15", "saldo": 90, "estado": "al dia" }]
}
```

### Ejemplo: reportes del dueño

Responden a las preguntas de fin de mes: qué se vende más, qué deja poco margen y cómo rinde cada caja.

```bash
curl "localhost:3000/reportes/margen-productos?desde=2026-10-01&hasta=2026-10-31"
```

```json
[
  { "codigo": "AMX500", "producto": "Amoxicilina 500mg", "unidades": 21, "ingresosBs": 63, "costoBs": 50.4, "margenBs": 12.6, "margenPorcentaje": 20 },
  { "codigo": "PAR500", "producto": "Paracetamol 500mg", "unidades": 30, "ingresosBs": 45, "costoBs": 18, "margenBs": 27, "margenPorcentaje": 60 }
]
```

El costo sale de los lotes que realmente se vendieron (FEFO), así que el margen refleja las compras a distintos precios.

## Arquitectura

```
src/
  app.js            # arma la app Express (inyección de servicios para tests)
  servicios.js      # crea todos los servicios conectados entre sí
  persistencia.js   # guarda/carga el estado en un archivo JSON (escritura atómica)
  datos-ejemplo.js  # farmacia de ejemplo de Santa Cruz (npm run seed)
scripts/seed.js     # CLI que escribe los datos de ejemplo en DATA_FILE
  auth.js           # login JWT, middleware de sesión y permisos por rol
  routes/           # capa HTTP: valida query/params, aplica permisos y delega
  services/
    usuarios.js     # usuarios, roles y contraseñas con scrypt
    inventario.js   # productos, lotes y descuento FEFO
    alertas.js      # vencimientos y stock mínimo
    ventas.js       # ventas todo-o-nada con trazabilidad de lotes
    reportes.js     # ticket, cierre diario y reportes del dueño
    proveedores.js  # droguerías y laboratorios, días de crédito
    compras.js      # ingreso de lotes por compra y cuentas por pagar
tests/              # Jest + Supertest (servicios, API y permisos)
  helpers/sesion.js # app de prueba con admin y cajero ya logueados
```

### Persistencia

Todo (productos, lotes, ventas, compras, proveedores y usuarios) se guarda en un archivo JSON (`DATA_FILE`, por defecto `data/farmacia.json`). Cada operación exitosa que modifica datos se escribe en disco **antes** de responder, con escritura atómica (archivo temporal + `rename`): un corte de luz no deja el archivo a medias. Las contraseñas se guardan solo como hash scrypt. Al reiniciar el servidor se cargan los datos y se continúa la numeración de ventas y compras.

Para hacer una copia de seguridad basta con copiar ese archivo.

*(La tabla crece con cada avance del proyecto.)*

## Roadmap

- [x] Estructura Express + Jest
- [x] Productos con lotes y descuento FEFO
- [x] Alertas de vencimiento y stock mínimo
- [x] Ventas con ticket y cierre diario
- [x] Proveedores, compras y cuentas por pagar
- [x] Autenticación JWT con roles admin / cajero
- [x] Reportes para el dueño (más vendidos, margen por producto, ventas por cajero)
- [x] Persistencia en archivo con guardado automático
- [x] Datos de ejemplo de Santa Cruz (`npm run seed`)
- [ ] Base de datos SQLite/PostgreSQL para varias sucursales

## Licencia

MIT
