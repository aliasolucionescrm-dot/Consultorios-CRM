# Remisiones, ajustes financieros, inventario y laboratorios

Implementación inicial del 01/10/2026. Migraciones 0039–0042; ejecutar el proceso habitual de migración antes de desplegar esta versión. No sustituir la base de datos existente.

## Especialistas externos

La ficha del paciente permite seleccionar un especialista externo activo, registrar el motivo y dar seguimiento: pendiente, atendido, informe recibido o cancelado. El informe de regreso queda en el expediente con historial de versiones y autor. Las correcciones conservan lo anterior. Se requieren permisos de expediente clínico; registrar una remisión no envía mensajes al especialista.

## Cambios de presupuesto y devoluciones

Al aceptar una nueva versión se trasladan los abonos vigentes del acuerdo anterior, descontando sus devoluciones. Se conservan pagos y recibos originales y se registra la relación entre acuerdos. El traslado requiere una justificación. Un excedente aparece como saldo a favor; no genera una devolución automática. No se permite trasladar saldo positivo entre monedas distintas.

Una devolución registra dinero ya devuelto, con pago de origen, importe, método, sucursal, motivo, referencia y responsable. No ejecuta transferencias bancarias. No puede superar el importe todavía disponible del pago, incluso ante solicitudes simultáneas. Un pago con devoluciones no puede anularse. El permiso de devolución se asigna inicialmente a propietario y administrador.

Los cortes nuevos (formato 3) incorporan devoluciones como egresos, en su propia fecha, sucursal, método y moneda. El arqueo descuenta las devoluciones en efectivo. Los cortes históricos conservan su copia original; los anteriores al formato 3 no incluyen estas devoluciones. El recibo mantiene su importe y saldo históricos y muestra las devoluciones registradas al consultarlo.

Límites: un acuerdo con pagos vigentes al doctor sigue bloqueado para sustitución, hasta conciliar su participación. No hay corrección/anulación de una devolución ni asientos contables generales. Esas operaciones requieren un flujo compensatorio separado.

## Inventario por sucursal

El módulo Inventario permite crear artículos con código, unidad y mínimo, consultar existencias por sucursal, registrar entradas, salidas y ajustes justificados y consultar movimientos. La salida no permite existencia negativa. Cambios concurrentes se serializan; los reintentos de una misma captura no duplican el movimiento. Artículos inactivos mantienen su historial.

Esta versión trabaja con unidades enteras. Lotes, caducidades, fracciones, costos/valuación, traspasos entre sucursales y consumo automático por tratamiento quedan pendientes.

## Laboratorios

El módulo Laboratorios administra el directorio. En la ficha del paciente se solicita un trabajo con laboratorio, sucursal, descripción y fecha prevista. El seguimiento permite solicitado → enviado → recibido → entregado, o cancelación antes de entrega, con notas, informe e historial. Recepción y entrega requieren informe; el recibido se conserva al entregar.

Pendientes: costos y pagos al laboratorio, integración explícita de archivos a órdenes/remisiones, impresión de remisiones y retrabajos posteriores a entrega. Los adjuntos privados del expediente siguen disponibles por separado.

## Integridad

Los registros pertenecen a la organización y al paciente correspondientes, con permisos y aislamiento RLS. Movimientos, devoluciones y versiones clínicas son inmutables; la actualización de versiones usa control de concurrencia. Las listas de seguimiento muestran los últimos 50 registros; historiales hasta 100 versiones. Inventario, movimientos y devoluciones tienen paginación.
