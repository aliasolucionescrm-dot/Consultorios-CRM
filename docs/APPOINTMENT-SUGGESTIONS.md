# Sugerencias de horario

Nueva cita y reprogramación incluyen Buscar horarios disponibles después de seleccionar paciente, profesional, consultorio y servicio. Se buscan hasta 12 opciones, cada 15 minutos desde el inicio indicado hasta el final de ese día, en la zona de la organización. Pulsar Usar actualiza el inicio sin guardar la cita. Cambiar datos invalida las sugerencias visibles.

POST appointments/suggestions exige appointments.view y CSRF. Valida recursos activos, sucursal, paciente y relaciones de servicios/consultorios. Lee turnos, bloqueos y reservas de todas las sucursales que afecten al paciente o profesional. Respeta intervalos abiertos al final y preparación posterior para recursos, sin alargar la ocupación del paciente. Omite horas pasadas y horas locales inexistentes o ambiguas; un inicio inválido devuelve error. En reprogramación se excluye únicamente la cita indicada de ese paciente, si está pendiente o confirmada.

No bloquea recursos ni garantiza disponibilidad futura. El guardado conserva todas sus validaciones transaccionales. Si no hay horario semanal configurado, informa que debe confirmarse el turno; no inventa horarios de apertura. Un horario configurado vacío no ofrece opciones. Las series sugieren solo la primera ocurrencia y validan toda la serie al guardar.

No busca automáticamente en otros días, profesionales o consultorios. Sin cambios de esquema.
