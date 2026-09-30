# Pagos y saldo por paciente

Ficha → Pagos y saldo. Requiere un presupuesto aceptado. Registra dinero ya recibido como Anticipo, Abono o Liquidación, con método Efectivo/Tarjeta/Transferencia/Otro, sucursal activa, referencia opcional y observaciones. No procesa cobros, tarjetas ni transferencias. No guardar datos completos de tarjeta ni códigos de seguridad. Fecha/hora son las reales del registro; captura retroactiva pendiente.

El resumen muestra total del acuerdo, suma de pagos vigentes y saldo. Moneda e importe base provienen del acuerdo inmutable, no de la propuesta más reciente ni de configuración cambiante. Importes positivos en centavos; no permite exceder saldo. Liquidación debe cubrir exactamente el saldo. No hay sobrepagos/saldo a favor. Un presupuesto de importe cero ya se muestra sin saldo.

Historial paginado de 20 movimientos con folio, versión del acuerdo, moneda, importe, método, nombre de sucursal al capturar, referencia, notas, autor y fecha. El resumen se calcula sobre todos los pagos vigentes, no solo la página visible. Actualizar pagos y saldo recupera cambios de otras sesiones. Aceptar presupuesto en la misma ficha actualiza el panel si no hay captura pendiente.

## Correcciones y acuerdos

Anular registro erróneo requiere payments.void, motivo y confirmación de que es una corrección de captura. Crea un registro inmutable de anulación, conserva el pago original y recalcula saldo. No es devolución ni transferencia de dinero. Se permite corregir registros de pacientes inactivos, pero no crearles pagos nuevos. No hay edición ni borrado de movimientos.

Mientras exista un pago vigente no puede sustituirse la aceptación del presupuesto. Puede prepararse una propuesta, pero aceptar requiere el futuro flujo de ajustes financieros. No anular pagos reales para cambiar el acuerdo. Si todos los registros fueron anulados por ser erróneos, puede aceptarse una nueva versión, conservando el historial anterior. Cancelaciones, devoluciones, transferencias entre acuerdos y sustitución con pagos existentes pendientes.

## Permisos y persistencia

Consulta: patients.view + payments.view. Captura añade payments.create; anulación añade payments.void. Propietario y Administrador pueden consultar/capturar/anular; Caja consulta/captura y Contabilidad consulta. Caja/Contabilidad reciben patients.view para acceder a la ficha administrativa, sin acceso clínico. Roles personalizados requieren permisos explícitos. Se actualizan roles de organizaciones existentes y definiciones para nuevas organizaciones.

Migración 0030: patient_payments y payment_voids con RLS forzada y solo SELECT/INSERT para el rol de aplicación. Auditoría de consulta/captura/anulación sin importes ni notas en auditoría general. Mutaciones con CSRF, validación de tenant/paciente/acuerdo/sucursal, request_id/hash y bloqueo compartido con aceptación del presupuesto. Reintentos idénticos no duplican pagos ni anulaciones, incluso después de anular el original. Solicitudes concurrentes no pueden superar el saldo ni reemplazar el acuerdo mientras se registra un pago.

Datos de formulario permanecen en memoria al fallar; actualizar/descartar pide confirmación y recargar advierte cambios. Cambiar de módulo puede perder el borrador. Tras éxito se oculta el formulario y se consulta saldo nuevo; ante falla de esa consulta no se ofrece otro pago hasta actualizar.

Pendiente: recibos imprimibles, facturación, corte de caja, conciliación, devoluciones, ajustes entre acuerdos y participación/liquidación del profesional. Su porcentaje seguirá calculándose sobre el total del tratamiento según la preferencia confirmada, con distribución y reglas todavía por definir.
## Recibos imprimibles

Historial → Ver recibo → Imprimir recibo / guardar PDF. El diálogo del navegador permite imprimir o guardar PDF; no se genera factura fiscal ni se envía al paciente. Acceso con patients.view y payments.view; auditoría de consulta. El endpoint solo entrega datos del recibo, excluyendo notas internas del pago, hashes de solicitud y procedimientos clínicos.

Folio igual al ID del pago, paciente/expediente, clínica, sucursal, moneda, importe, tipo, método, referencia, versión del presupuesto, registrador y fecha del pago. Nuevos pagos conservan receipt_context en la misma transacción: datos del paciente/clínica tomados del acuerdo, nombre del registrador al capturar y saldo inmediatamente posterior. Se etiqueta como saldo histórico, no saldo actual. Migración 0031. Pagos anteriores sin contexto muestran datos conservados en el acuerdo y nombre actual del registrador, con advertencia; no se inventa saldo histórico.

Antes de solicitar impresión se vuelve a consultar el estado. Anulados muestran marca prominente, motivo/autor/fecha y omiten el saldo histórico para evitar confusión. La impresión incluye fecha de consulta; copias impresas o descargadas no pueden actualizarse ante anulaciones posteriores. HTML escapado y marco sin scripts; no contiene firmas. Las pruebas sustituyen print por un espía; impresora física y archivo PDF resultante no verificados.
Corte de registros por sucursal/responsable/periodo implementado en Administración → Corte de caja; ver CASH-CLOSURES.md. No es arqueo físico ni bloqueo de periodo.
