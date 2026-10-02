# Participación del doctor

Caja → Participación del doctor → seleccionar paciente; también disponible en la ficha. Propietario/Administrador consultan y asignan; Contabilidad consulta. Permisos independientes professional_shares.view/manage, junto a patients.view. Caja y roles clínicos no reciben acceso financiero a estas asignaciones por defecto.

Un doctor responsable interno o externo activo por acuerdo aceptado. Búsqueda progresiva (hasta 20 coincidencias). Porcentaje entre 0 y 100, hasta dos decimales. Base: total de la versión aceptada después de descuentos, no lo cobrado al paciente. Cálculo entero con BigInt y redondeo de medio centavo hacia arriba. Moneda del acuerdo, sin conversiones.

Guarda nombre/relación del profesional, base, porcentaje, resultado, folio, autor y fecha. Cambiar el catálogo no altera esos datos. Corregir crea una versión nueva, motivo obligatorio; un porcentaje cero también requiere explicación. Últimas 25 asignaciones visibles, todas conservadas. No se suman versiones. Aceptar otro presupuesto deja las asignaciones del anterior como históricas y requiere una nueva asignación explícita.

El servidor valida acuerdo vigente, paciente activo, profesional activo y organización. Comparación de versión y bloqueo compartido con aceptación/pagos evitan capturas obsoletas. Request ID/hash hace idempotentes los reintentos; reutilizarlo con otros datos devuelve conflicto. Migración 0034 con RLS forzada y SELECT/INSERT solamente. Auditoría sin importes ni notas en el registro general.

El formulario conserva la captura ante errores, advierte al recargar y confirma descarte al actualizar. Cambiar de módulo puede descartar el borrador. Guardar participación no registra transferencias, egresos ni liquidaciones al doctor. No equivale a honorarios pagados o exigibles automáticamente.

Siguiente bloque: liquidaciones profesionales con pagos parciales, saldo e historial de correcciones; deberá bloquear o conciliar cambios de asignación/acuerdo cuando existan pagos al profesional. Repartos entre varios doctores, porcentajes por procedimiento y deducciones específicas quedan pendientes.

## Pagos al profesional

Debajo de la participación, «Pagos al doctor» muestra asignado, pagado y pendiente del acuerdo vigente. Registra abonos o liquidación exacta del saldo, método (efectivo, transferencia u otro), sucursal activa, referencia y notas. Confirmación expresa de dinero ya entregado. No ejecuta transferencias bancarias ni modifica pagos/saldo del paciente. No depende de lo cobrado al paciente.

Permisos professional_payments.create/void para Propietario/Administrador; lectura mediante professional_shares.view y patients.view (incluye Contabilidad). Caja y roles clínicos sin acceso por defecto. Se permite registrar obligaciones ya asignadas aunque paciente/profesional estén inactivos; la sucursal de captura debe estar activa.

Control de saldo dentro del mismo bloqueo de paciente utilizado por aceptación, asignación y pagos: evita sobrepagos concurrentes y escrituras sobre asignaciones sustituidas. Pagos vigentes bloquean cambiar la participación y aceptar otro acuerdo. Reintentos idempotentes mediante request_id/hash. Importes positivos y moneda heredada de la asignación.

Anular solo corrige una captura errónea: motivo, confirmación, autor/fecha y original conservados. No representa una devolución ni debe usarse para cambiar un acuerdo realmente pagado. Historial paginado de 20 registros incluye pagos de asignaciones anteriores y anulaciones; el saldo corresponde solo a la asignación vigente. Migración 0035 con RLS y SELECT/INSERT, sin borrar ni editar registros. Los movimientos se fechan al registrarse; no existe fecha retroactiva en este bloque.

Los pagos en efectivo al profesional todavía NO se descuentan automáticamente del corte/arqueo. Siguiente bloque: integrarlos como egresos en nuevas consultas de caja, conservando cortes históricos y evitando doble conteo con ajustes manuales. Reporte por profesional y recibos de liquidación pendientes.

Actualización 01/10/2026: los nuevos cortes y arqueos ya incluyen egresos profesionales. Los cortes previos permanecen intactos. Las anulaciones son referencia, sin devolución automática de efectivo. Ver CASH-CLOSURES.md para fórmula y revisión obligatoria contra duplicar ajustes. Próximo bloque: recibos de pago al profesional y posteriormente reporte por doctor/periodo.

## Recibos de pagos al doctor

En el historial, «Ver recibo del doctor» abre la vista previa; «Imprimir recibo del doctor / guardar PDF» consulta de nuevo el estado de anulación y abre la impresión del navegador. Elegir Guardar como PDF para exportar. Incluye doctor/relación conservados en la asignación, importe/moneda, método, sucursal, referencia, autor, fecha, folios de pago/asignación, versión de presupuesto y participación pactada. No incluye nombre ni datos clínicos del paciente o notas internas de captura.

Migración 0036 añade receipt_context: pagos nuevos conservan clínica, registrador y saldo inmediatamente posterior al pago. Los anteriores usan clínica del acuerdo y registrador consultado actualmente; se marcan como históricos y no reconstruyen un saldo. Anulados muestran fecha, autor y motivo, sin saldo histórico. Es constancia administrativa, no factura, verificación bancaria ni acuse firmado por el doctor.

GET /api/patients/:patientId/professional-payments/:paymentId/receipt requiere patients.view y professional_shares.view, restringe paciente/organización y audita consulta. Fallar la consulta previa impide imprimir. El estado es válido al momento de consulta, no se actualizan copias ya impresas.
