# Reporte profesional

Reportes → Abrir reporte profesional (también desde Caja). Selección de un profesional con búsqueda progresiva, incluidos internos/externos e inactivos. Fechas inclusivas de 1 a 31 días según zona de organización, sin futuro. Incluye todas las sucursales; el filtro es el profesional beneficiario, no el usuario que capturó el pago.

Movimientos del periodo: pagos y anulaciones por su propia fecha de registro, por moneda, sin sumar monedas. Neto = pagos registrados menos anulaciones registradas. Una anulación de un pago anterior al periodo puede producir neto negativo; no significa devolución real de dinero. Detalle de 20 movimientos por página con método, sucursal, autor del evento, referencia/motivo, nombre conservado de la asignación y folio. Recibo accesible desde cada movimiento con consulta de estado actual.

Saldo actual (todas las fechas): asignado, pagos vigentes acumulados y pendiente de las últimas asignaciones de los acuerdos aceptados vigentes. No es saldo al cierre del periodo. Selecciona la última asignación antes de filtrar por doctor: los responsables sustituidos no conservan saldos obsoletos. Incluye pacientes inactivos; propuestas no aceptadas excluidas. Todos los cálculos se leen en una transacción REPEATABLE READ para evitar mezclar estados concurrentes.

API GET /api/professional-report/options?q= y GET /api/professional-report?professional_id=&from=&to=. Permisos patients.view y professional_shares.view; Contabilidad puede consultar, Caja sin permiso profesional no puede. Organización forzada en contexto RLS y SQL; auditoría de consulta. Máximo 2000 movimientos; si excede, rechaza y requiere reducir periodo, sin totales truncados. Búsqueda hasta 20 resultados. No expone nombres ni datos clínicos de pacientes. El encabezado usa nombre actual del doctor; detalle conserva el nombre de cada asignación.

Consulta informativa sin guardado inmutable, exportación ni bloqueo de periodos. No modifica movimientos. Próximo bloque: impresión del reporte con ambos alcances claramente separados, antes de retomar comunicaciones pendientes.

## Impresión del reporte

Tras consultar, abrir «Ver documento del reporte profesional» y «Imprimir reporte profesional / guardar PDF». Imprime exactamente los datos revisados de esa consulta: clínica, profesional, periodo, zona horaria, fecha de consulta, monedas separadas, saldo actual y todos los movimientos (no solo la página visible). Para refrescar cifras, cerrar y volver a consultar. Cambiar doctor o fechas retira el documento anterior.

Formato HTML A4 con texto escapado, CSP sin scripts/recursos externos, cabeceras de tabla repetibles. PDF mediante Guardar como PDF del navegador; no se almacena automáticamente un archivo ni un corte. La fecha de consulta aclara vigencia y se indica que el saldo no corresponde al cierre del periodo. No incluye IDs ni nombres de pacientes en la impresión.
