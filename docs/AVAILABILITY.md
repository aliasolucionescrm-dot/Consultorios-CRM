# Horarios laborales y bloqueos

Disponible desde Agenda → Horarios de atención / Bloquear periodo. Migración 0007.

- Horarios semanales por profesional y sucursal, en la zona de la organización. Hasta 28 turnos por semana; varios turnos por día permiten descansos. Sin turnos en un día: cerrado. No admite turnos que crucen medianoche.
- Sin horario configurado se conserva disponibilidad semanal sin restricciones. Guardar una semana vacía cierra todos los días. La pantalla distingue ambos casos; no se inventan horarios para los catálogos existentes.
- Administradores con `catalogs.manage` editan horarios; quienes tienen `appointments.view` los consultan. Cambios versionados y motivo obligatorio.
- Bloqueos por profesional (todas sus sucursales) o consultorio, con inicio, fin y motivo. Pueden abarcar varios días para vacaciones o mantenimiento. `appointments.edit` permite crearlos/liberarlos. No se borran; liberación versionada y auditada.
- No se permite crear un bloqueo sobre citas vigentes ni cambiar turnos dejando citas futuras fuera del horario. Primero deben reprogramarse/cancelarse. Citas completadas conservan ocupación histórica; canceladas/inasistencias no ocupan.
- Crear/reprogramar citas valida turnos y bloqueos dentro de la misma transacción. Todas las escrituras de disponibilidad y reservas toman el mismo advisory lock por organización antes de leer disponibilidad; así una carrera entre bloqueo y reserva solo permite una operación. Las restricciones de superposición de citas siguen en PostgreSQL.
- Dos nuevas tablas con RLS forzado, referencias compuestas por organización y permisos restringidos. Auditoría transaccional de cambios. La validación de disponibilidad se implementa en la API: escrituras SQL directas privilegiadas no pasan por ella.

## API

`GET availability/schedule?professional_id=UUID&branch_id=UUID` → `weekly`, `version` (0 si no configurado).

`POST availability/schedule` → `professional_id`, `branch_id`, `version`, `reason`, `weekly: [{day:1..7,start:"09:00",end:"18:00"}]` (lunes=1).

`GET availability/blocks?branch_id=UUID&date=YYYY-MM-DD&page=1` → bloques activos que intersectan el día, 50 por página. Incluye bloqueos de profesionales asignados a la sucursal aunque se hayan creado en otra.

`POST availability/blocks` → `branch_id`, `kind: professional|room`, `resource_id`, `start_local`, `end_local`, `reason`. Fechas locales `YYYY-MM-DDTHH:mm`; horas ambiguas/inexistentes se rechazan.

`PATCH availability/blocks/:id/release` → `version`, `reason`.

## Límites

Actualización manual; los bloqueos se consultan por fecha. No incluye horarios propios de la sucursal/consultorio, recurrencia de bloqueos, festivos, buffers de limpieza, vigencias futuras de turnos, excepciones por fecha ni sugerencias automáticas de huecos. Cambiar la zona de la organización reinterpreta el horario semanal; requiere revisión operativa de reservas existentes. No hay pruebas de carga: serializar por organización prioriza consistencia sobre volumen elevado. Las consultas de validación revisan todas las reservas futuras afectadas; pueden necesitar optimización a gran escala.

Siguiente bloque: vistas semanal/mensual y filtros visuales por profesional/consultorio. La fase clínica sigue pendiente.

## Verificación

55 pruebas de integración aprobadas, con turnos/descansos, días cerrados, versiones, bloqueo sobre citas, liberación, aislamiento RLS y carrera entre bloqueo de consultorio y reserva. Seis E2E de agenda/disponibilidad aprobadas en escritorio/móvil. Tipos, lint y build correctos. Captura móvil inspeccionada y barra de acciones ajustada para evitar desbordamiento.
