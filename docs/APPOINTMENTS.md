# Agenda diaria — fase 2, tercer bloque

Actualización: horarios semanales y bloqueos ya implementados. Ver [disponibilidad](AVAILABILITY.md), que sustituye los pendientes relativos a estos controles descritos en el alcance inicial de este documento.

Vista `/#agenda`, por sucursal activa y fecha, con lista cronológica paginada de 100 citas. Navegación de día anterior/siguiente, hoy y actualización manual. Formularios adaptables para crear, reprogramar y cambiar estados. Pacientes y recursos se buscan en PostgreSQL; los selectores indican cuándo es necesario acotar resultados. El servicio sugiere duración, modificable de 5 a 480 minutos.

## Reglas implementadas

- Zona horaria de la organización, independiente de la del navegador. Fechas locales convertidas con Temporal; horas inexistentes o repetidas por cambio de horario se rechazan explícitamente. Instantes almacenados como `timestamptz`; zona original conservada en cada versión.
- PostgreSQL rechaza superposiciones para paciente, profesional y consultorio en toda la organización. Intervalos `[inicio,fin)`: dos citas contiguas son válidas. Canceladas e inasistencias liberan la reserva; completadas conservan la ocupación histórica.
- Exclusiones GiST con `btree_gist`, verificadas con solicitudes concurrentes. Referencia: [rangos y exclusiones PostgreSQL](https://www.postgresql.org/docs/17/rangetypes.html).
- Paciente, servicio, profesional, consultorio y sucursal activos al reservar/reprogramar. Profesional asignado a la sucursal y consultorio perteneciente a ella. Referencias compuestas por organización, RLS forzado y rol de ejecución restringido.
- Creación idempotente mediante UUID de solicitud y hash de datos. Reintentos idénticos recuperan el mismo ID; reutilizar una solicitud con otros datos devuelve 409. Control de versión para reprogramar y cambiar estado.
- Reprogramar requiere motivo, conserva el paciente y vuelve a pendiente. No se reprograman citas que ya llegaron ni las terminadas/canceladas.
- Estados: pendiente → confirmada/llegada/cancelada/inasistencia; confirmada → llegada/cancelada/inasistencia; llegada → en consulta/cancelada; en consulta → completada. Estados finales no se reabren. Cancelación e inasistencia requieren motivo.
- Historial inmutable con usuario, motivo, versión y datos de la reserva. Auditoría transaccional de creación, reprogramación y estado. La API muestra las últimas 100 versiones del historial.
- Permisos `appointments.view/create/edit`; búsqueda de pacientes del formulario requiere además `patients.view`. Opciones de agenda exponen únicamente identificador, nombre y duración, sin costos.

## API

- `GET /api/appointments?date=YYYY-MM-DD&branch_id=UUID[&page=N&professional_id=UUID&room_id=UUID]` devuelve citas que intersectan el día local, incluidas canceladas. Los filtros de profesional/consultorio están disponibles en API, aún no en pantalla.
- `GET /api/appointments/options?branch_id=UUID&q=texto`: hasta 50 profesionales, consultorios y servicios activos, con indicador de más resultados.
- `POST /api/appointments`: `request_id`, `branch_id`, `patient_id`, `professional_id`, `room_id`, `service_id`, `start_local` (`YYYY-MM-DDTHH:mm`), `duration_minutes`.
- `PATCH /api/appointments/:id`: mismos campos de reserva, sin `request_id`, con `version` y `reason`.
- `PATCH /api/appointments/:id/status`: `version`, `status`, `reason` cuando aplica.
- `GET /api/appointments/:id/history`: versiones descendentes. Todas las rutas requieren sesión y organización; mutaciones requieren CSRF y origen permitido.

## Límites y siguiente incremento

No incluye horarios laborales, vacaciones, descansos, bloqueos, tiempos de limpieza, recurrencias, lista de espera, recordatorios ni confirmación externa. No se valida si una cita está dentro del horario de atención. No hay calendario semanal/mensual, arrastre de citas, actualización en tiempo real ni carga probada a gran escala. La agenda actual es una lista diaria operativa, no el calendario completo de la especificación inicial.

Los nombres de catálogos se muestran con su valor actual; historial conserva IDs, horario, zona y estado, no copias de nombres o precios. Cambiar la zona de la organización cambia la presentación de instantes existentes, no sus instantes almacenados. Se permiten reservas pasadas y marcar estados futuros; reglas temporales más estrictas quedan pendientes. No hay reactivación ni corrección de estados terminales en esta versión.

La página se actualiza manualmente y al guardar; los conflictos muestran errores conservando el formulario. Ante una versión obsoleta, cerrar y actualizar agenda antes de reabrir. No hay recuperación de borradores al navegar. La sucursal se elige en el selector superior; cambiarla descarta el formulario actual. Los selectores buscables reutilizan endpoints existentes y no agregan caché con datos personales.

Siguiente bloque: horarios semanales y bloqueos de recursos con validación transaccional; después calendario semanal/mensual y filtros visuales. Fase clínica continúa pendiente.

## Verificación

Migración 0006 aplicada en PostgreSQL local. Diez pruebas nuevas de integración: idempotencia concurrente, cada tipo de cruce, reservas adyacentes, carrera por un horario, aislamiento entre organizaciones, asignación de sucursal, rollback y versiones, cancelación, flujo de estados, fechas/DST, RLS y permisos. Suite total: 52 pruebas aprobadas. Dos recorridos nuevos Playwright: alta, reprogramación, recarga, historial y cancelación en escritorio y móvil; total 8 E2E aprobadas. Capturas móviles inspeccionadas; sin desbordamiento horizontal.

## Mejora del flujo de recepción

Selectores con un solo campo y resultados filtrados al escribir (200 ms), clic o flechas/Enter y Escape para cerrar. Pacientes por nombre, teléfono o expediente; resultados muestran teléfono para distinguir homónimos. Se descartan respuestas de búsquedas anteriores. Alta rápida dentro de la reserva con nombre, apellidos y teléfono opcional, visible con patients.create; conserva recursos y horario elegidos. El paciente se guarda primero y la reserva se confirma por separado; cancelar el formulario no elimina al paciente. La búsqueda previa ayuda a evitar duplicados, pero no hay deduplicación automática. Recepción tiene permisos para consultar/crear pacientes y crear/editar citas. No incluye llamadas automáticas ni autoservicio del paciente.

Verificación de esta mejora: tipos, lint y build correctos; 4 recorridos E2E de agenda aprobados (paciente existente y alta rápida, escritorio/móvil). Captura móvil inspeccionada.
