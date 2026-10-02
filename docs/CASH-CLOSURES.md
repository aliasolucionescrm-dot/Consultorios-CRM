# Corte de caja: registros por periodo

Administración → Corte de caja. Consultar una sucursal, fechas Desde/Hasta inclusive (máximo 31 días y sin fechas futuras), y opcionalmente responsable del cobro. Fechas interpretadas en zona horaria de la organización mediante Temporal; hasta exclusivo corresponde a medianoche local del día siguiente, sin asumir días de 24 horas. Incluye sucursales inactivas para consulta histórica y responsables con pagos históricos.

Vista previa con pagos registrados, anulaciones registradas y neto por moneda/método; no se suman monedas diferentes. El detalle conserva fecha de evento, folio del pago, método, cobrador y referencia/motivo. Máximo 2000 eventos por consulta; si excede, requiere reducir periodo/responsable, nunca guarda un total truncado. Detalle visible en páginas de 20 eventos y lista de cortes en páginas de 20 cortes.

Cada pago suma en su fecha de registro; cada anulación resta en su propia fecha de registro, incluso si el pago ocurrió antes del periodo. Puede resultar un neto negativo cuando se corrigen registros anteriores. El filtro de responsable y sucursal aplica al pago original, no al usuario que anuló. Anular una captura no equivale a devolver dinero; los importes son netos de registros, no movimientos bancarios verificados.

Guardar corte revisado solicita confirmación y admite observaciones. Conserva copia inmutable del resultado, filtros, nombres, zona horaria, folio, autor y fecha de guardado. Compara hash de la vista previa con los datos al guardar; si hay cambios requiere nueva consulta/revisión. request_id/hash evita duplicación por reintentos concurrentes; reutilizar con otros datos devuelve conflicto. Una consulta SQL reúne pagos/anulaciones; es una copia de registros visibles a dicha consulta, no congela transacciones posteriores.

No bloquea periodos ni crea turnos de caja. Los cortes pueden solaparse y no deben sumarse entre sí. No incluye arqueo de efectivo físico, fondo inicial, gastos, retiros, depósitos, devoluciones, facturación fiscal, impresión/exportación ni liquidaciones profesionales. El siguiente bloque propuesto es arqueo con efectivo contado y diferencias por moneda, sin presentar el neto de registros como efectivo esperado cuando existan anulaciones de periodos anteriores.

Permisos nuevos cash_closures.view/create. Propietario, Administrador y Caja consultan y guardan; Contabilidad consulta. Estos permisos permiten consultar todos los responsables/sucursales de la organización; no hay restricción a caja personal. No se exponen datos clínicos o nombres de pacientes en el reporte. Actualizados roles existentes y nuevas organizaciones. Auditoría de vista previa, detalle y guardado. Migración 0032, tabla cash_closures con RLS forzada y SELECT/INSERT solamente para aplicación. Sin edición/borrado de cortes.

Vista previa y observaciones permanecen en memoria tras errores. Cambiar de módulo/recargar puede descartar la revisión no guardada. Abrir un corte histórico advierte si hay observaciones o confirmación pendientes. Tras pérdida de respuesta puede reintentarse el mismo guardado sin duplicar.
## Arqueo de efectivo

Abre un corte guardado → Registrar arqueo. Captura fondo inicial y efectivo contado por moneda; todas las monedas con efectivo del corte son obligatorias. Se pueden añadir MXN, USD o EUR aunque no tengan pagos, por ejemplo para un fondo inicial. No se convierten monedas ni se incluyen tarjetas/transferencias.

Cálculo en servidor: esperado declarado = fondo inicial + pagos en efectivo registrados + ajustes de entrada − ajustes de salida. Diferencia = contado − esperado. Resultado negativo significa faltante; positivo, sobrante. Las anulaciones del corte se muestran como referencia, pero no se restan automáticamente: el usuario revisa si corresponde una corrección justificada a la base documental. Esto evita tratar una captura errónea o una anulación de periodos anteriores como devolución de efectivo.

Cada ajuste requiere importe positivo y motivo, máximo 20 por moneda. Fondo y conteo no negativos, hasta dos decimales; no se admite esperado negativo. Faltantes/sobrantes requieren explicación. Confirmación expresa de que fondo, efectivo y ajustes corresponden al periodo/responsable del corte. Son declaraciones del usuario, no movimientos de dinero ni verificación independiente. No corrigen pagos, saldos de pacientes ni bancos.

Guardar conserva folio, autor, fecha de registro, valores de entrada y resultados inmutables. Corregir arqueo crea una versión nueva con motivo obligatorio; historial de últimas 25 versiones, anteriores conservadas. Control optimista por versión, request_id/hash y bloqueos para reintentos concurrentes sin duplicados. La base sigue siendo el corte guardado, aunque existan pagos posteriores: para otro alcance temporal se requiere consultar/guardar otro corte y contar efectivo correspondiente. No bloquea periodos, no abre/cierra turnos, ni arrastra automáticamente fondos de otros arqueos.

Migración 0033 cash_counts con RLS forzada y SELECT/INSERT. Consulta con cash_closures.view; captura/corrección añade cash_closures.create. Contabilidad solo consulta. Auditoría sin importes ni motivos en registro general. Recargar avisa si hay borrador; actualizar/descartar pide confirmación. Mientras se captura o guarda se bloquean filtros y apertura de otro corte en esta vista para evitar perder cambios; navegar de módulo puede descartarlos.

Pendiente: arqueo por denominaciones, impresión/exportación de corte y arqueo, aprobación supervisora, turnos y movimientos reales de fondos/retiros/gastos. No confundir estos ajustes declarados con un módulo contable de egresos o devoluciones.

## Impresión de corte y arqueo

En un corte guardado, abrir «Ver documento del corte». La vista previa incluye folio, autor, fechas en la zona de la organización, filtros, totales separados por moneda/método, observaciones y todos los movimientos (sin la paginación de pantalla). No imprime borradores; mientras se captura un arqueo se deshabilita el acceso al documento.

Puede incluirse el último arqueo guardado (predeterminado), una de sus últimas 25 versiones o solo el corte. Cada arqueo muestra su folio, versión, autor, fondo, pagos, anulaciones de referencia, ajustes/motivos, esperado, contado y diferencia/explicación. Versiones anteriores se identifican como tales; no tener arqueo no equivale a diferencia cero.

«Imprimir corte / guardar PDF» vuelve a consultar corte y arqueos con los permisos existentes antes de abrir el diálogo del navegador. Si la consulta falla, no imprime. La copia registra la fecha de consulta; no refleja correcciones posteriores. Para PDF elegir Guardar como PDF en ese diálogo. Documento HTML A4 con texto escapado, sin scripts ni recursos externos. No añade firmas, aprobación supervisora ni facturación fiscal.

## Egresos profesionales integrados (01/10/2026)

Las nuevas consultas guardan snapshot `schema_version: 2`. Incluyen cobros, anulaciones de cobros, pagos al doctor y anulaciones de pagos al doctor en una consulta SQL; máximo 2000 eventos entre todos. Por moneda/método: neto de registros = cobros − anulaciones de cobros − pagos al doctor + anulaciones de pagos al doctor. El reporte conserva folios de cada origen y etiquetas diferenciadas. No expone nombres de pacientes ni datos clínicos.

El filtro se llama «Responsable del registro»: es quien capturó el pago original, no el profesional beneficiario ni quien lo anuló. El catálogo incluye responsables con egresos aunque no tengan cobros. Sucursal y responsable de anulaciones se toman del pago original; la fecha corresponde a la anulación. La misma interpretación de días/zona horaria se aplica a los cuatro tipos de evento.

Arqueo de un corte nuevo: esperado = fondo inicial + cobros en efectivo registrados − pagos al doctor en efectivo registrados + ajustes. Transferencias/tarjetas no alteran este cálculo. Las anulaciones de ambos tipos son referencias y NO se convierten automáticamente en devolución/reintegro de dinero. Si una captura fue errónea, una corrección manual requiere motivo y revisión de qué dinero entró/salió realmente. No se admite esperado negativo.

Si hay egresos profesionales en efectivo o sus anulaciones, una confirmación específica es obligatoria (también en API) antes de guardar el arqueo: revisar egresos y no duplicarlos como ajustes. Se muestra el importe descontado y se conserva la confirmación en el resultado. No se copian ajustes entre cortes. Este control requiere revisión humana: no puede deducir duplicados a partir del texto libre de un ajuste.

Cortes ya guardados sin schema_version 2 conservan sus cifras y fórmula originales, con aviso «Corte histórico: no incluye egresos profesionales». No se añaden pagos nuevos, no se recalculan arqueos guardados y no se sobrescriben ajustes antiguos. Para incorporar egresos se consulta y guarda otro corte, revisando su nuevo arqueo; ambos cortes pueden solaparse y no deben sumarse. La impresión distingue el alcance histórico y muestra egresos/anulaciones en el nuevo formato. Sin migración de tablas en este bloque.
