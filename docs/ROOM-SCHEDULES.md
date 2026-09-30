# Horarios de consultorios

Agenda → Horarios de atención → Horario de: Consultorio permite seleccionar una sala de la sucursal y definir turnos semanales, incluidos descansos mediante turnos separados. Reutiliza el editor de horarios de profesionales.

Sin configuración no hay restricción semanal adicional. Después de guardar, los días sin turnos están cerrados; guardar una lista vacía cierra toda la semana. Los turnos no pueden superponerse ni cruzar medianoche. La zona horaria es la de la organización. El horario pertenece al consultorio y se conserva si cambia de sucursal.

Reservas, reprogramaciones, series y sugerencias deben cumplir tanto el horario del profesional como el del consultorio, incluyendo la preparación posterior. Los bloqueos y conflictos existentes siguen aplicándose. Cambiar turnos utiliza el bloqueo de agenda y rechaza cambios que dejen fuera reservas futuras, incluida su preparación.

GET/POST availability/room-schedule requieren appointments.view/catalogs.manage respectivamente. Guarda versiones y motivo auditado. Migración 0013 con claves compuestas, RLS forzado y permisos mínimos. No incorpora festivos automáticos; se usan bloqueos para excepciones.
