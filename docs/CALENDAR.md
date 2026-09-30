# Vistas de calendario

Actualización: las tarjetas originales descritas abajo fueron sustituidas por FullCalendar 7.1.0 con cuadrícula horaria, clic para detalle y arrastre validado. Ver PHASE2-REVIEW.md para el alcance vigente, límite de eventos y verificación. Los apartados siguientes documentan el incremento anterior.

Agenda ofrece Día, Semana y Mes. Semana comienza en lunes. Mes incluye los días adyacentes necesarios para completar semanas. Anterior/siguiente avanza según la vista; Hoy vuelve a la fecha local de la organización.

Cada día muestra el total real y hasta tres resúmenes ordenados por inicio. Al seleccionar un día, la lista inferior muestra sus citas con paginación, detalle, estados y reprogramación. Nueva cita usa la fecha seleccionada. Citas que cruzan medianoche aparecen en cada día que intersectan. Canceladas e inasistencias se incluyen, con su estado visible; el total no representa únicamente ocupación activa.

Filtros buscables por profesional y consultorio afectan tanto el calendario como la lista diaria. Quitar filtros reinicia la selección y los campos. Los selectores muestran recursos activos; consultar citas de recursos desactivados requiere quitar filtros. Los bloqueos continúan visibles por día para toda la sucursal y se gestionan en el panel inferior; no se dibujan en las casillas del calendario.

`GET /api/appointments/calendar?date=YYYY-MM-DD&days=1..42&branch_id=UUID[&professional_id=UUID&room_id=UUID]` requiere `appointments.view`. Devuelve fecha, total y hasta tres resúmenes por día. Agregación SQL con RLS y zona de la organización; el límite de resúmenes no trunca el conteo. No modifica reservas ni controles de disponibilidad.

En escritorio hay siete columnas; pantallas pequeñas muestran tarjetas en orden cronológico en dos/tres columnas para mantener legibilidad. No incluye cuadrícula por horas, arrastre, cambio de duración con ratón, filtros de estado ni actualización en tiempo real. Seleccionar una fecha de otro mes centra el calendario en ese mes. Las listas conservan paginación de 100 registros; los filtros se reinician al salir de la agenda.

Verificación: 56 pruebas de integración aprobadas; navegación semanal/mensual, selección de fecha, filtros y ausencia de desbordamiento probados en escritorio/móvil. Build, tipos y lint correctos. Siguiente bloque del plan: ampliar búsqueda global a entidades operativas.
