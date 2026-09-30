Actualización: la API de adjuntos ya integra el adaptador; ver PATIENT-ATTACHMENTS-API.md. El texto siguiente documenta el bloque inicial.

# Base de almacenamiento privado

## Alcance de este bloque

Adaptador interno LocalPrivateStorage con operaciones put/get/remove y configuración explícita. No se instanció en la API, no hay endpoint de carga o descarga ni nueva interfaz; las fichas todavía no aceptan archivos. No se añadieron permisos ni tablas de adjuntos. Es la base para el siguiente incremento, no una función terminada de archivos clínicos.

## Formato y aislamiento

- Directorio absoluto configurado con PRIVATE_STORAGE_DIR, fuera de directorios públicos/estáticos y excluido de Git. Para desarrollo se recomienda una ruta dentro de .local/private-files.
- Clave dedicada de 32 bytes en PRIVATE_STORAGE_KEY (64 caracteres hexadecimales). No se reutiliza la clave MFA ni se generan claves automáticamente.
- AES-256-GCM con IV aleatorio de 12 bytes, etiqueta de autenticación y cabecera ALIAFILE1. La organización y el identificador forman los datos autenticados: copiar un objeto a otra organización o cambiar su identificador impide descifrarlo.
- Rutas construidas solo con UUID; no se usan nombres originales como rutas. Límites de 1 byte a 10 MiB. Escritura exclusiva: no sobrescribe identificadores existentes.
- Los permisos de creación solicitados son 0700 para carpetas y 0600 para archivos. En Windows se deben configurar ACL del directorio; los modos POSIX no sustituyen esas ACL. La carpeta debe pertenecer al proceso y no permitir manipulación de enlaces por terceros.

## Contrato de integración pendiente

El adaptador no autentica usuarios: el controlador que lo use debe comprobar sesión, organización, permiso y pertenencia del adjunto antes de cada operación. La separación de carpetas y el cifrado no sustituyen autorización.

Próximo bloque: tabla de metadatos con RLS y estados de carga, listado y descarga autenticada; validación de formato/tamaño, auditoría y compensación ante fallos de base o disco. Un objeto solo debe publicarse en metadatos después de completar la escritura; si una escritura se interrumpe, no debe considerarse disponible. Descarga como adjunto con no-store y nosniff; decidir por separado vista previa de imágenes y escaneo de documentos antes de habilitarlos. El método remove es para compensación interna: no habilita eliminación clínica por sí mismo.

## Operación

No se modificó Compose para activar almacenamiento. Antes de producción se requiere un volumen persistente privado con propietario adecuado, respaldos consistentes de archivos/metadatos y custodia de la clave fuera de ese volumen. Perder la clave impide recuperar archivos; cambiarla sin recifrado impide leer objetos anteriores. Rotación multiclave, cuotas por organización, antivirus y S3 siguen pendientes. El contrato PrivateStorage permite un futuro adaptador S3, conforme a ARCHITECTURE.md.

## Verificación

Tres pruebas nuevas comprueban ciclo de escritura/lectura/retiro, ausencia de texto original en disco, sobrescritura rechazada, rutas y tamaños inválidos, clave errónea, alteración de bytes y sustitución entre organizaciones/identificadores. Las pruebas usan directorios temporales propios y verifican el destino antes de limpiarlos. No se emplearon archivos reales de pacientes.
