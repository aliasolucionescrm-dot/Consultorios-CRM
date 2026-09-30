# Ampliación solicitada — 30 septiembre 2026

Requisitos del mensaje y captura del usuario, incorporados al plan. Esta lista distingue lo disponible de lo pendiente; no implica que todas las funciones estén terminadas.

## Decisiones confirmadas

- Recordatorios y confirmaciones: WhatsApp y correo electrónico.
- Participación del doctor: porcentaje sobre el total del tratamiento, no sobre lo cobrado. Falta definir porcentaje por doctor y reglas ante descuentos, cambios, cancelaciones y devoluciones. Debe conservarse la base pactada y separar participación calculada de lo efectivamente pagado al doctor.
- Colores para condiciones alérgicas, alimenticias, farmacológicas, sistémicas e infectocontagiosas. Siempre acompañados de nombre y texto, con acceso clínico; el color no representa automáticamente gravedad ni diagnóstico.

## Bloques y dependencias

1. **Presupuestos**: primera base implementada desde el plan, cantidades, precios, descuentos por renglón, total e historial. Aceptación registrada por personal y documento imprimible implementados. Pendientes: varias alternativas independientes, evidencia firmada/verificada del acuerdo, vigencia, anulación y vínculo con pagos.
2. **Expediente y odontograma ampliados**: antecedentes y notas generales ya disponibles; agregar condiciones categorizadas con estado desconocido/sin antecedentes reportados/reportado y detalle, diagnóstico documentado por el profesional por pieza/superficie o boca, notas ligadas a citas y correcciones trazables. Ningún diagnóstico automático por fotografías.
3. **Recetas**: autocompletar datos del paciente y profesional responsable, datos profesionales configurables, desglose de medicamento/presentación/dosis/vía/frecuencia/duración/indicaciones. Borrador revisable, emisión e historial y documento imprimible; validar los campos y requisitos aplicables antes de habilitar emisión. No sugerir dosis automáticamente.
4. **Pagos y caja**: anticipos, parcialidades, saldo e historial por paciente/presupuesto; recibos, métodos de pago, anulaciones con motivo y corte de caja por usuario/sucursal/periodo. Cálculos en centavos, idempotencia y conciliación. Vincular responsable y porcentaje pactado sobre total del tratamiento, con historial y liquidación independiente. No cambiar saldos históricos al editar catálogos.
5. **Documentos clínicos y consentimientos**: fotografías anotadas y adjuntos privados ya disponibles; ampliar estudios/radiografías panorámicas/análisis de sangre con tipo, fecha y contexto clínico, formatos soportados explícitos y permisos clínicos. Consentimientos por paciente/procedimiento, plantilla versionada y evidencia de aceptación; una carga de archivo no equivale por sí sola a firma verificada.
6. **Comunicación**: automatización de recordatorios por ambos canales, confirmación del paciente mediante enlace seguro y caducable, notificación al consultorio, cancelación/reprogramación de envíos pendientes, preferencias del paciente, deduplicación, reintentos y estado de entrega. Requiere proveedor WhatsApp y SMTP productivo configurados; no se han enviado mensajes externos. Definir tiempos antes de habilitar envíos automáticos.
7. **Seguimiento**: enlace para calificar consultorio y doctor después de la atención, destino configurable y registro de envío. Pendiente definir destinos de reseña.

Relaciones familiares bidireccionales ya implementadas. Mantenerlas desde la ficha; no crear un segundo registro de parentescos.

## Relaciones del consultorio y papelería — ampliación del usuario

Requisitos incorporados, pendientes de implementación salvo las bases expresamente señaladas:

- **Pacientes**: una ficha común reúne historial clínico, citas, documentos, consentimientos, presupuestos y movimientos financieros. La participación de varios doctores no debe duplicar el expediente.
- **Doctores internos**: registrar el vínculo con el consultorio, especialidades, sucursales, disponibilidad, servicios y condiciones de participación. El catálogo profesional actual ya contiene datos profesionales y asignaciones; falta distinguir formalmente tipo de relación e historial de vigencia.
- **Especialistas externos**: directorio integrado al de profesionales con tipo de relación externo, contacto, especialidad, consultorio o institución de referencia y modalidades de atención dentro o fuera de la clínica. Distinguir remisión de paciente de una cita atendida en el consultorio. Registrar motivo de referencia, profesional remitente/receptor, estado y respuesta o informe vinculado al expediente. Registrar a un especialista no crea automáticamente una cuenta ni concede acceso a todos los expedientes; el acceso y cualquier envío de documentos deben ser explícitos y trazables.
- **Agenda general por doctores**: vista conjunta y filtros por profesional, especialidad y relación interno/externo; mantener disponibilidad y prevención de cruces existentes. Diferenciar visitas de especialistas dentro del consultorio de atenciones remitidas a una ubicación externa, que no deben ocupar artificialmente un sillón local. La base de agenda y profesionales ya existe; tipo de vínculo y remisiones siguen pendientes.
- **Contabilidad vinculada**: presupuesto, anticipos, abonos, saldo, liquidación del paciente y liquidación al doctor son registros relacionados pero distintos. Cada procedimiento debe poder identificar a su responsable interno o externo. El porcentaje se calculará sobre el total del tratamiento según lo confirmado; cuando intervengan varios profesionales, queda por definir cómo distribuir esa base para no duplicarla. Conservar montos pactados, ajustes y comprobantes con permisos propios.
- **Papelería del consultorio**: centro de plantillas con identidad de la clínica, datos del paciente y del profesional, fecha, procedimiento y versión. Alcance propuesto: recetas, consentimientos, referencias a especialistas, indicaciones, presupuestos y comprobantes. Documento generado editable como borrador; documento emitido con historial y copia conservada. No insertar datos de otro paciente al reutilizar una plantilla.
- **Consentimientos por especialidad/procedimiento**: ortodoncia, endodoncia (confirmada por el usuario), cirugía y extracción. Cada plantilla debe poder vincularse al paciente, procedimiento, profesional responsable y cita, con estados borrador/pendiente/completado/anulado, fecha y evidencia documental. No reutilizar una aceptación para un procedimiento diferente ni presentar una plantilla genérica como validada para todos los casos.

Antes de pagos y liquidaciones, incorporar el tipo de relación del profesional y definir la distribución cuando participan varios doctores. Antes de generar papelería, configurar los datos de clínica/profesional y las plantillas aplicables. Estas ampliaciones complementan los bloques anteriores; no sustituyen las condiciones clínicas, diagnóstico y notas por cita previstos como siguiente bloque.

Orden de verificación: aislamiento entre clínicas, permisos por rol, cambios concurrentes, trazabilidad, experiencia móvil y estados de carga/error/guardado. El plan continúa por bloques utilizables; cada bloque debe indicar qué se terminó y qué sigue pendiente.

Actualización: bloque 2 implementado en su alcance inicial. Condiciones por categoría/color/texto, diagnóstico general y por pieza/superficie, notas opcionalmente ligadas a citas con datos históricos preservados. Ver CLINICAL-EXPANSION.md. El siguiente bloque prepara la relación interno/externo y datos profesionales para recetas y papelería.

Directorio ampliado: clasificación interno/externo, datos para futura papelería y contactos externos sin sucursal implementados. Remisiones, acceso externo, calendario fuera de clínica y liquidaciones siguen pendientes. Ver PROFESSIONAL-RELATIONSHIPS.md.

Recetas: preparación de borradores versionados implementada con datos del paciente/profesional y medicamentos desglosados. Emisión, firma y documento imprimible continúan pendientes; ver PRESCRIPTION-DRAFTS.md.

Recetas: revisión y preparación de documento imprimible para firma autógrafa implementadas. No hay emisión firmada/electrónica ni recetarios especiales; ver PRESCRIPTION-PREPARATION.md.

Consentimientos: plantillas propias por categoría y preparación de documentos del paciente implementadas. Texto histórico conservado. Impresión, evidencia documental privada y estados de aceptación/rechazo/anulación implementados. Firma electrónica verificada y vínculo a cita pendientes; ver CONSENTS.md.


Pagos: registro manual de anticipos/abonos/liquidación, saldo por acuerdo aceptado y anulación de capturas erróneas implementados. Sin transacciones bancarias, recibos imprimibles, corte, devoluciones ni reparto profesional todavía. Bloqueada la sustitución de acuerdos con pagos vigentes hasta disponer de ajustes; ver PAYMENTS.md.
Recibos administrativos imprimibles implementados para pagos vigentes/anulados; se guardan datos históricos en pagos nuevos. Corte de caja, facturación fiscal, devoluciones, ajustes y liquidaciones profesionales siguen pendientes.
Corte de registros implementado con filtros, copia revisada e historial; no incluye todavía arqueo físico, apertura/cierre de turnos, fondos, gastos ni impresión. Ver CASH-CLOSURES.md. Devoluciones y liquidaciones profesionales siguen pendientes.
Arqueo de efectivo manual implementado con ajustes declarados y diferencias por moneda, versiones de corrección y permisos. Se basa en corte guardado y no ejecuta egresos/devoluciones. Impresión del corte/arqueo y turnos pendientes.
