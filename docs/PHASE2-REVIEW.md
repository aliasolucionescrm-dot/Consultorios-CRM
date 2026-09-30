# Revisión de fase 2 — 29 septiembre 2026

La operación de recepción está implementada en los alcances siguientes. La fase 2 completa sigue pendiente; esta matriz sustituye las notas acumulativas anteriores.

| Área | Implementado | Pendiente |
|---|---|---|
| Pacientes | Datos administrativos, folios, búsqueda, etiquetas, alta rápida desde cita, próxima cita, familiares, foto de perfil, permisos y RLS | Saldo y tratamientos dependen de fases posteriores |
| Profesionales | Identidad, especialidad, cédulas, sucursales, turnos, servicios y consultorios habilitados | Fotografía, firma y documentos; comisiones y relación laboral posteriores |
| Consultorios | Catálogo, reservas, prevención de conflictos, bloqueos y horarios semanales | Recursos adicionales reservables |
| Servicios | Duración, precios/costos e historial, requisitos y profesionales habilitados | Materiales, impuestos y comisiones |
| Agenda | Día/semana/mes, arrastre con confirmación, estados, historial, versiones, filtros, preparación, recurrencias, sugerencias y bloqueos visibles | Columnas por recurso, actualización entre sesiones en tiempo real y recordatorios externos |
| Búsqueda | Pacientes, acciones y entidades operativas con permisos | Benchmark con gran volumen, enlaces compartibles y búsqueda clínica cuando exista |

## Revisión de recepción

Se agregó una prueba de integración usando un usuario con rol Recepción: alta por llamada, búsqueda por teléfono, sugerencias, reserva, próxima cita, reprogramación, confirmación, llegada, consulta y finalización. Se verifican historial y denegación de administración de catálogos y horarios. La interfaz sigue ofreciendo a recepción las acciones de agenda de su rol; no se modifica la política de permisos.

Los recorridos de navegador de reservas ahora crean recursos ficticios propios, evitando depender del primer elemento del catálogo, que puede tener restricciones o turnos configurados por otra prueba. Se revisan alta rápida sin perder borrador, reserva, reprogramación, persistencia, cancelación, próxima cita y familiares. Los recorridos de navegador usan la cuenta propietaria de demostración; la comprobación específica del rol Recepción se realiza en la API.

## Límites operativos

- Las sugerencias muestran hasta 12 opciones cada 15 minutos del mismo día y recursos. En series solo proponen la primera ocurrencia; el guardado valida toda la serie.
- Sin turnos configurados no se restringen horas semanales. Un horario guardado vacío cierra la semana.
- Las series son de 2–24 citas semanales/quincenales; los cambios posteriores son individuales.
- El calendario muestra hasta 1,000 citas y 1,000 bloqueos por periodo. Si se supera un límite, se oculta el contenido parcial y se pide reducir el periodo.
- Los bloqueos permanecen visibles para toda la sucursal aunque se filtren citas. Los de profesionales afectan a todas sus sucursales.
- La próxima cita abre el día y sucursal; no selecciona automáticamente su detalle. Las relaciones familiares no comparten acceso ni datos clínicos.
- La agenda requiere actualización manual para cambios de otras sesiones. El arrastre táctil no se considera validado; móvil dispone del formulario de reprogramación.

## Evidencia actual

67 pruebas de integración aprobadas en base aislada. Build y ESLint aprobados. La verificación de este bloque se registra en VERIFICATION.md. No se ejecutaron pruebas de carga ni auditoría externa de seguridad; esta revisión no acredita despliegue productivo.

## Próximo incremento

Persistir fecha y sucursal en la navegación de agenda para conservar el contexto al recargar o volver desde una ficha. Después priorizar archivos/fotografías y recursos adicionales. El módulo clínico requiere su propia implementación y validación.

Contexto de agenda persistente por sesión implementado; ver AGENDA-NAVIGATION.md. Próximo incremento: preparar almacenamiento privado para archivos/fotografías.

Base técnica local para archivos privados preparada y probada; PRIVATE-STORAGE.md define el alcance. Fotografías/archivos en fichas siguen pendientes hasta integrar metadatos, API y UX.

API de adjuntos administrativos implementada; PATIENT-ATTACHMENTS-API.md. Fotografía de perfil y panel de archivos siguen pendientes.

Panel de adjuntos administrativos en fichas implementado; PATIENT-ATTACHMENTS-UI.md. Los límites productivos de almacenamiento y validación documental siguen descritos en PATIENT-ATTACHMENTS-API.md.

Fotografías clínicas anotadas implementadas; ver CLINICAL-PHOTOS.md. No completa el expediente clínico ni el odontograma. Permisos clínicos separados de archivos administrativos.

