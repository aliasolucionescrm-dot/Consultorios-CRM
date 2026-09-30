# Bloqueos en calendario

Las vistas día, semana y mes reciben bloqueos activos junto con las citas en appointments/events. Se dibujan en rojo como eventos no editables. Seleccionar un bloqueo abre recurso, inicio, fin, zona horaria, motivo y alcance. Su liberación sigue en el panel de bloqueos del día.

Se incluyen todos los bloqueos de la sucursal y los de profesionales asignados a ella aunque se hayan creado en otra sucursal. Los filtros de profesional/consultorio afectan a citas; los bloqueos permanecen completos, como se explica en pantalla. Se incluyen intervalos que cruzan el inicio o fin del periodo, con límites abiertos al final.

Crear o liberar desde el panel refresca el calendario. Los cambios de otras sesiones se consultan al actualizar la agenda. No se arrastran ni redimensionan bloqueos. Un espacio visual vacío no garantiza disponibilidad; los horarios semanales y las validaciones de reserva siguen siendo determinantes.

El endpoint limita citas y bloqueos a 1,000 por tipo. Si cualquiera excede su límite devuelve tooMany y listas vacías, evitando mostrar un calendario parcial como disponible. Exige appointments.view y conserva RLS. Sin migraciones nuevas.
