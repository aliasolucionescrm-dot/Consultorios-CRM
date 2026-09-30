# Foto de perfil del paciente

En el encabezado de la ficha, Añadir/Cambiar foto de perfil permite seleccionar PNG, JPEG o WebP de hasta 10 MiB, previsualizar y guardar. Quitar restaura las iniciales. El original permanece como adjunto administrativo privado y no se elimina. El directorio conserva iniciales; no incluye recorte manual.

Migración 0018: asociación por paciente con RLS y versión optimista. Lectura requiere patients.view; cambios patients.edit y paciente activo. Solo admite imágenes administrativas del mismo paciente y organización; rechaza imágenes clínicas. Descarga mediante el endpoint autenticado de adjuntos. Los reintentos de carga y asignación son idempotentes.

El límite de cargas es compartido con los adjuntos. Un fallo de asignación permite reintentar usando la imagen ya subida. Una edición concurrente requiere actualizar la ficha.
