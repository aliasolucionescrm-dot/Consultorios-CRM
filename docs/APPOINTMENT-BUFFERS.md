# Tiempo entre pacientes

Cada cita admite `buffer_minutes`, entero de 0 a 120, configurable en el formulario de creación/reprogramación. La duración clínica mantiene su significado: `ends_at` es el final de atención; `occupied_until` es el final de atención más preparación. El paciente solo está reservado durante atención. Profesional y consultorio están reservados durante ambos periodos.

La migración 0008 asigna margen cero a las citas existentes. Un trigger PostgreSQL calcula `occupied_until` en cada escritura; las exclusiones GiST de profesional y consultorio usan ese extremo. La exclusión del paciente conserva `ends_at`. Los periodos son semiabiertos: otra cita puede comenzar exactamente cuando termina la preparación.

Crear/reprogramar valida que atención y preparación completas entren en el turno del profesional y no intersecten bloqueos. Crear un bloqueo y modificar horarios también consideran la preparación de reservas existentes. Cancelación/inasistencia liberan ambos periodos; completadas conservan ocupación histórica. RLS, permisos y versionado existentes continúan aplicando.

El API acepta `buffer_minutes` opcional: creación omitida = 0; edición omitida = conservar valor anterior. Esto preserva clientes anteriores y el margen durante el arrastre. El formulario permite modificarlo explícitamente. Historial guarda margen y extremo ocupado en nuevas versiones; versiones históricas anteriores no se reescriben.

Calendario dibuja un evento de preparación adicional no arrastrable para citas con margen activo. Lista y detalle muestran minutos y hora de liberación. Las consultas de eventos incluyen reservas cuya preparación intersecta el rango incluso si la atención terminó antes. El conteo legado por día sigue contando atención, no eventos adicionales de preparación.

Límites: no hay margen previo ni márgenes distintos para profesional/consultorio. No hay valor predeterminado global o por servicio: recepción lo define por reserva; cero conserva compatibilidad. No se permite reservar preparación fuera de turno. La validación dentro del turno requiere mismo día local. No se ha probado carga masiva ni todos los escenarios DST.

Verificación: migración aplicada, 59 pruebas de integración aprobadas; incluye preparación frente a otra cita/bloqueos, límite exacto, horario, validación de valores y conservación/historial al mover. Cuatro E2E de agenda aprobadas en escritorio/móvil con margen de 15 minutos. Build, tipos y lint correctos.

Siguiente incremento: citas recurrentes con validación de toda la serie en una transacción.
