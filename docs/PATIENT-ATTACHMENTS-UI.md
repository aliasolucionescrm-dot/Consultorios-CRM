# Archivos en la ficha del paciente

La sección Archivos del paciente lista adjuntos administrativos con nombre, tamaño, fecha y descarga. Permite seleccionar PNG/JPEG/PDF hasta 10 MiB, quitar la selección y subir. El archivo solo se envía al pulsar Subir archivo. La selección se conserva después de un error para reintentar con el mismo request_id; elegir otro archivo genera otra solicitud.

Durante la carga se deshabilita el selector y se muestra Guardando archivo. Hay estados de lista vacía, carga, error, éxito y paginación de 25 registros. El rol necesita patients.edit y ficha activa para ver la carga; todos los que pueden consultar la ficha pueden descargar según patients.view. Las fichas inactivas mantienen la consulta de adjuntos.

La descarga se realiza mediante fetch con cookie y X-Organization-Id, y después un enlace temporal local del navegador. El enlace se revoca; no se publica una URL del servidor. No hay visor inline, eliminación ni foto de perfil.

Entorno local: PRIVATE_STORAGE_DIR configurado en .local/private-files y clave dedicada en .env. Ambos excluidos de Git. La clave no se imprime ni se copia a documentación. No se modificaron los requisitos pendientes de producción del documento PATIENT-ATTACHMENTS-API.md.

Pruebas de navegador en escritorio/móvil: selección inválida rechazada, fallo simulado y reintento con el mismo identificador, carga real, recarga, descarga y comparación de bytes, y ancho móvil. Solo se usaron archivos ficticios.
