# Preferencias y vista previa de recordatorios

Anticipación confirmada por el usuario: **24 horas antes**, con correo electrónico y WhatsApp disponibles. Existen preferencias, vista previa y una cola persistente detenida. Por decisión posterior del usuario, WhatsApp funciona por ahora mediante apertura manual con mensaje precargado. El sistema no envía mensajes automáticamente ni genera enlaces de confirmación todavía.

En la ficha del paciente, Recordatorios de citas permite registrar ambos canales, uno o ninguno, previa revisión de contactos y una nota de cómo se confirmó la preferencia. Ningún canal se autoriza por defecto. WhatsApp requiere código de país; no se infiere desde el teléfono general. Se conservan versiones inmutables con responsable y fecha; la pantalla muestra las últimas 20.

La vista previa consulta hasta 50 citas futuras pendientes o confirmadas. Calcula el instante de la cita menos 24 horas y muestra las fechas en la zona de la cita. Una nueva consulta refleja reprogramaciones y excluye cancelaciones. Horarios de recordatorio ya pasados no se consideran elegibles para envío retroactivo. Pacientes inactivos, contactos inválidos o distintos del contacto autorizado quedan marcados como no aptos. Un paciente inactivo solo puede desactivar canales.

API: GET/POST `/api/patients/:patientId/reminder-preferences`, GET `/preview` bajo esa ruta. Consulta requiere `patients.view`; edición también `patients.edit`; vista previa también `appointments.view`. Migración 0037, aislamiento por organización, historial sin UPDATE/DELETE, control de versión concurrente y bloqueo de ficha al revisar contactos. Ante conflicto o respuesta perdida, actualizar antes de volver a guardar.

## Cola persistente (0038)

Los cambios en citas, preferencias y correo/WhatsApp/estado del paciente actualizan la cola dentro de la misma transacción, mediante funciones SQL con permisos del invocador y RLS. Una clave única por organización, cita, versión de cita, versión de preferencia y canal evita duplicar preparaciones al reintentar. La sincronización por paciente serializa cambios concurrentes. La migración prepara los registros elegibles existentes bajo el rol de migración del proyecto.

Estado `held`: preparado, envío deshabilitado. Reprogramación, cambio de estado, nueva preferencia, cambio de contacto o desactivación invalidan registros anteriores (`canceled`); solo se preparan registros nuevos si siguen siendo elegibles y su instante de recordatorio es futuro. Registros vencidos se muestran como `expired` al consultarlos y también se actualizan al reconciliar. No hay trabajador de envío, recuperación de recordatorios pasados ni reactivación de registros invalidados; volver a autorizar contactos requiere guardar una nueva preferencia. Las filas anteriores se conservan.

GET `/api/patients/:patientId/reminder-preferences/queue` permite consultar los últimos 50 registros, indica si hay más y requiere `patients.view` y `appointments.view`. No expone destinos ni mensajes. La ficha muestra explícitamente que la cola está detenida y permite actualizar la consulta tras modificar una cita.

## WhatsApp manual (0.3.29)

Ficha del paciente → Recordatorios de citas → WhatsApp manual → Ver próximas citas → Preparar mensaje. Se listan hasta 20 citas futuras pendientes/confirmadas, incluidas las de menos de 24 horas que no generaron cola. Borrador editable, número visible con código de país, opción de restablecer/cerrar y apertura por acción explícita. El mensaje inicial incluye primer nombre, clínica, sucursal y fecha/hora en la zona de la cita; pide confirmar respondiendo por WhatsApp. No incluye diagnósticos, tratamientos ni identificadores internos.

API `/api/patients/:patientId/whatsapp-reminders`: GET lista; POST `/:appointmentId/draft` prepara; POST `/:appointmentId/link` revalida y devuelve enlace. Requiere paciente/cita de la organización, paciente activo, WhatsApp autorizado y contacto actual coincidente. Lectura requiere `patients.view` y `appointments.view`; preparación/apertura también `patients.edit`. Un token de revisión detecta cambios de cita, contacto, preferencias o datos incluidos en el borrador. El texto editado admite hasta 2000 caracteres y se codifica como parámetro de URL.

Se utiliza [Click to chat oficial de WhatsApp](https://faq.whatsapp.com/5913398998672934). La cuenta utilizada es la que esté iniciada en el navegador/dispositivo. Se reserva la ventana durante el clic para compatibilidad móvil, se elimina `opener` y se cierra si la revalidación falla. Si el navegador bloquea ventanas, se explica cómo volver a intentar. La aplicación no puede comprobar que WhatsApp abrió correctamente, ni que se envió/recibió/leyó el mensaje. El usuario pulsa Enviar allí. Los cambios posteriores a abrir WhatsApp no pueden retirar el texto de esa aplicación.

No modifica la cita ni marca la cola como enviada. Auditoría registra preparación del borrador/enlace con usuario/cita, sin guardar texto, número ni URL; no representa evidencia de envío. Borrador local no guardado, con confirmación al descartarlo desde sus controles. No requiere proveedor, token o plantilla de Meta; no se habilitó ningún trabajador automático.

Siguiente bloque propuesto: seguimiento manual de respuestas y confirmación de cita desde recepción, distinguiendo declaración del usuario de verificación externa. Automatización por correo/WhatsApp, deduplicación de entregas y enlaces de confirmación quedan para una ampliación posterior.
