# Plantillas y consentimientos del paciente

Administración → Plantillas de consentimiento: texto propio de la clínica para ortodoncia, endodoncia, cirugía, extracción u otro procedimiento. No se incluyen textos clínicos/legales preaprobados. El editor admite nombre, categoría, texto literal de 20 a 20000 caracteres y estado Borrador/Disponible/Retirada. Habilitar Disponible requiere confirmar revisión del equipo. La aplicación registra esta declaración, no certifica validez jurídica.

Cada guardado crea una versión inmutable. El historial permite consultar versiones previas; solo la última es editable mediante nueva versión. Catálogo paginado de 20 plantillas actuales o 20 versiones al abrir un historial. Consulta con catalogs.view y edición con catalogs.manage. No se interpretan variables, HTML ni instrucciones dentro del texto.

Ficha → Consentimientos del paciente → Preparar consentimiento: buscar plantilla disponible y doctor activo mientras se escribe, elegir procedimiento de una versión guardada del plan y añadir observaciones. La categoría se muestra para que el profesional revise su pertinencia; el sistema no infiere si una plantilla es adecuada al procedimiento. Los procedimientos cancelados en la versión elegida no son seleccionables.

El servidor valida organización, paciente activo, profesional activo, procedimiento del paciente y última versión disponible de plantilla. Conserva texto, categoría, datos del paciente/responsable, clínica, profesional y procedimiento en una copia histórica. Retirar o cambiar una plantilla no altera documentos previos. Reintentos idénticos con request_id no duplican registros; reutilizar la solicitud con contenido distinto devuelve conflicto. Seleccionar un plan histórico se conserva expresamente como referencia, sin actualizar su contenido al cambiar el plan.

Los documentos se preparan Pendientes de aceptación y muestran autor, fecha y folio. Ver documento y decisión abre una vista imprimible del texto histórico; permite imprimir o guardar PDF mediante el diálogo del navegador. La copia no contiene firmas ni acredita aceptación por sí sola. No se incorporan cláusulas clínicas o legales automáticas.

Lectura del paciente: patients.view y clinical_records.view; preparación añade clinical_records.edit. Datos con RLS forzada y permisos SELECT/INSERT. Migraciones 0027 y 0028. Borrador en memoria con aviso al recargar; navegación interna puede descartarlo. No hay envío externo.

## Decisiones y evidencia

Registrar decisión permite aceptación, rechazo o anulación. La aceptación exige nombre de firmante, relación con el paciente y archivo firmado PDF/JPEG/PNG/WebP de hasta 5 MiB. La interfaz solicita revisar su correspondencia con el paciente y documento; la aplicación no verifica identidad, autenticidad de firmas ni validez jurídica. Rechazo y anulación requieren motivo. Todas las decisiones incluyen fecha declarada (no futura), fecha real de registro y autor.

Transiciones: pendiente → aceptación/rechazo/anulación; aceptación o rechazo → anulación. Anulado es terminal. El historial no se modifica ni borra. Corregir una decisión implica anular con motivo y preparar otro consentimiento. La evidencia previa sigue disponible después de anular. Crear una nueva plantilla no cambia el texto del consentimiento preparado.

Eventos inmutables en consent_events con RLS, permisos SELECT/INSERT, versión optimista y request_id/hash para reintentos idénticos, incluidos concurrentes. La descarga y el detalle requieren permisos clínicos; los archivos no aparecen como adjuntos administrativos. Almacenamiento privado cifrado reutilizado, comprobación SHA-256/tamaño al descargar y auditoría de consultas/decisiones/descargas. Se autentica antes de recibir cuerpos de hasta 7 MiB, con límite de 30 intentos de registro por usuario/clínica/hora.

Se valida extensión, MIME, cabecera del archivo y tamaño; no es análisis antivirus ni validación integral del documento. No borrar archivos ante errores ambiguos después de guardarlos: una falla entre almacenamiento y confirmación de base puede dejar un archivo cifrado huérfano pendiente de conciliación. Mantener copia de base, almacenamiento y clave privada conforme al despliegue.

Pendiente: firma electrónica verificada, vinculación a cita y flujos de envío externo. El borrador de decisión se mantiene en memoria tras errores; cerrar/actualizar pide descartar y recargar advierte cambios. Navegar a otro módulo puede descartarlo.
