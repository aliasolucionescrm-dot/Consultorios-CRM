# API de adjuntos administrativos de pacientes

## Operaciones

Base: /api/patients/:patientId/attachments. GET lista hasta 25 metadatos por página, con hasMore. POST carga JSON con request_id UUID, filename, media_type y content_base64 canónico. GET :id/content descarga bytes. Todas requieren cookie de sesión y X-Organization-Id; POST además Origin y X-CSRF-Token.

Lectura/descarga requieren patients.view; carga requiere patients.edit y paciente activo. Los registros históricos de pacientes inactivos siguen consultables. Este alcance comparte los permisos de la ficha administrativa; no es un repositorio de documentación clínica con permisos diferenciados.

PNG, JPEG y PDF, entre 1 byte y 10 MiB. Se comprueban extensión, MIME declarado y firma inicial, no estructura completa ni ausencia de malware. No admite HTML/SVG/ejecutables. La carga pasa por autenticación antes del parser JSON de 14 MiB; otras rutas conservan sus límites. Se admiten 30 intentos por usuario y organización por hora. Nginx incorpora el límite mayor solo para la ruta de adjuntos.

## Persistencia

Migración 0014: patient_attachments con claves de paciente/organización, RLS forzado y privilegios SELECT/INSERT. Registra tamaño, hash SHA-256, autor, nombre, tipo e identificador de solicitud. No expone rutas ni claves. Reintentar la misma solicitud y contenido devuelve el mismo registro; cambiar el contenido con el mismo request_id devuelve 409. El bloqueo transaccional serializa esos reintentos.

Primero escribe el objeto cifrado y después inserta metadatos y auditoría en una transacción. Un fallo de escritura no publica metadatos. Un fallo de base posterior puede dejar un objeto cifrado huérfano: no es descargable por la API. No se elimina automáticamente tras un resultado ambiguo del commit; la reconciliación futura deberá comparar metadatos y objetos. No hay endpoint de borrado.

## Descarga

Comprueba organización, paciente, identificador, cifrado y hash/tamaño. Solo entonces registra auditoría y devuelve application/octet-stream, Content-Disposition attachment, no-store y nosniff. No existen URLs públicas ni vistas previas embebidas. Los fallos de configuración, lectura o integridad devuelven 503 sin rutas ni información sensible.

## Configuración y límites

Requiere PRIVATE_STORAGE_DIR absoluto y PRIVATE_STORAGE_KEY dedicado. No se generan claves ni se activa un volumen automáticamente. En el entorno local sin esas variables, listar funciona y cargar/descargar devuelve 503. Las pruebas configuraron un directorio temporal y una clave propia, sin tocar archivos de pacientes.

Compose aún requiere integrar volumen privado, permisos y variables para un despliegue real. La modificación de Nginx se revisó como configuración, no se probó dentro de Docker en este bloque. S3, antivirus, cuotas, reconciliación de huérfanos, rotación multiclave y borrado/retención siguen pendientes. No se presenta como módulo clínico productivo.

Siguiente incremento: panel de adjuntos en la ficha, carga con estado y descarga autenticada usando los encabezados de contexto. No es posible descargar con un enlace desnudo porque se requiere X-Organization-Id.
