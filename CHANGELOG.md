# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [1.0.0] - 2026-10-21

Primera versión estable.

### Agregado

- Productos con lotes, costo y fecha de vencimiento; salida de stock FEFO que nunca usa lotes vencidos.
- Alertas de lotes vencidos o por vencer (con valor en riesgo en Bs) y de stock bajo el mínimo.
- Ventas todo-o-nada con trazabilidad de lotes, pago en efectivo/QR/tarjeta y cálculo de cambio.
- Ticket para impresora térmica de 58 mm y cierre de caja diario por cajero o del local.
- Proveedores con días de crédito, compras que ingresan lotes y cuentas por pagar con abonos.
- Autenticación JWT, contraseñas con scrypt y permisos por rol (admin / cajero).
- Reportes del dueño: más vendidos, margen por producto y ventas por cajero.
- Persistencia en archivo JSON con escritura atómica y guardado antes de cada respuesta.
- Datos de ejemplo de una farmacia de Santa Cruz (`npm run seed`).
- CI en GitHub Actions con Node 20, 22 y 24.
