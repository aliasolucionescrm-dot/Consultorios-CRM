# Citas recurrentes

Nueva cita → Repetir cita: solo esta cita, cada semana o cada dos semanas. Entre 2 y 24 citas contando la primera. Comparten paciente, profesional, consultorio, sucursal, servicio, duración y margen posterior. Cada ocurrencia mantiene día/hora local de la organización; la conversión a UTC se hace individualmente. Una hora inexistente/ambigua por DST rechaza toda la serie con la fecha afectada.

`POST /api/appointments/series` recibe el cuerpo habitual de creación más `count` e `interval_weeks` (1 o 2). Requiere `appointments.create`, sesión, organización, origen y CSRF. Reutiliza la validación de citas dentro de una única transacción con lock de disponibilidad por organización. Horarios, bloqueos, activos, referencias de tenant y exclusiones de PostgreSQL se comprueban para cada ocurrencia. El primer conflicto devuelve 409 con número y fecha; no queda ninguna cita, historial o serie del intento fallido.

Migración 0009: tabla `appointment_series` con UUID de solicitud, hash y IDs de ocurrencias, RLS forzado y permisos SELECT/INSERT; FK compuesta desde citas. El reintento idéntico devuelve la misma serie sin duplicados. Reutilizar la solicitud con datos distintos devuelve conflicto. Auditoría transaccional de la serie y de cada cita. Los IDs de pertenencia son persistentes; los snapshots de creación de cita se generan antes de asignar la serie, y la auditoría de serie registra todos sus IDs.

La lista identifica citas de una serie. Reprogramación, cancelación y estados actúan sobre una sola cita; no se propagan a las demás. La serie no genera futuras citas de manera automática: crea todas sus ocurrencias al guardar. Sin edición/cancelación masiva, frecuencia mensual, selección de varios días, fecha final, excepciones o motor RRULE. Sin recordatorios externos.

Verificación: 60 pruebas de integración aprobadas, incluyendo reintentos concurrentes, intervalos quincenales, margen, RLS, límites y rollback al encontrar conflicto posterior. Dos E2E aprobadas en escritorio/móvil para creación semanal, navegación a la siguiente fecha y cancelación individual. Tipos, lint y build correctos.

Siguiente bloque: relación entre profesionales y servicios habilitados para facilitar la selección al reservar.
