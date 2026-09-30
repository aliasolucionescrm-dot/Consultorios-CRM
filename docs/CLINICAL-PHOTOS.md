# Fotografías clínicas con anotaciones

En Pacientes → ficha → Fotografías clínicas se pueden cargar PNG/JPEG/WebP privados de hasta 10 MiB y abrir el editor. Flechas y círculos se colocan con dos toques; notas con uno. Cada marca admite texto y pieza FDI permanente o temporal. El estudio incluye selección directa o desde una lista, arrastre de marcas, tiradores para extremos/tamaño, edición de comentario y pieza, duplicado, eliminación y hasta 50 pasos de deshacer/rehacer por sesión. Los tiradores tienen una zona táctil de 44 px. Zoom y Mover vista permiten recorrer la imagen ampliada. En escritorio las propiedades aparecen al lado; en móvil debajo de la imagen.

El original cifrado se conserva intacto. Las coordenadas normalizadas y notas se guardan aparte en versiones inmutables, con autor y fecha. El selector muestra las últimas 25 versiones. Una versión histórica es de solo lectura. Conflictos de edición devuelven 409 y conservan el borrador local; un reintento idéntico no duplica la versión.

Migración 0015: clasificación clínica de adjuntos y tabla photo_annotations con RLS forzada. Lectura requiere patients.view y clinical_records.view; carga/edición requiere patients.edit y clinical_records.edit. Recepción no accede a fotografías clínicas mediante sus permisos administrativos. Se auditan lecturas y escrituras sin copiar notas al registro de auditoría.

Alcance: anotación manual de imágenes, sin detección automática, odontograma, DICOM, exportación de imagen anotada ni comparación antes/después. La validación de archivo comprueba firma/formato/tamaño, no decodifica completamente la imagen en servidor. El navegador informa si no puede mostrarla. Cierre del editor y cambio de versión solicitan confirmar borradores; navegación interna fuera de la ficha todavía puede descartarlos. Aplican las limitaciones productivas del almacenamiento privado documentadas previamente.

WebP incorporado mediante migración 0016. Se valida extensión, contenedor RIFF/WEBP, cabecera de imagen y longitud declarada; el original se conserva sin conversión.

## Uso del estudio

1. Elige Flecha o Círculo y toca dos puntos; Nota se coloca con un toque. La nueva anotación queda seleccionada.
2. Arrastra la marca para moverla; arrastra los tiradores blancos para ajustar sus extremos. También puedes seleccionarla en la lista numerada.
3. Edita el comentario y la pieza en Propiedades. Aplicar comentario registra un paso de edición; Guardar cambios también incluye el comentario que estás escribiendo.
4. Duplicar crea otra marca editable. Eliminar permite recuperar la marca con Deshacer; Rehacer vuelve a aplicar el cambio. Ctrl/⌘ Z y Ctrl/⌘ Mayús Z funcionan dentro del editor, fuera de campos de texto. Las flechas del teclado mueven la selección y Supr la elimina.
5. Guarda para crear una versión. El historial se despliega por separado y las versiones anteriores son de solo lectura. El historial de deshacer/rehacer es local y se reinicia al guardar o cargar otra versión.

## Comentarios sobre la imagen

Tarjetas sobre el inicio de la marca muestran el comentario y la pieza, con vista previa al escribir. Se arrastran independientemente de la marca y su posición normalizada se conserva por versión mediante el campo opcional label. Las versiones anteriores sin label siguen funcionando. Ocultar comentarios mantiene visibles las marcas; Ver original oculta ambas. Las tarjetas permanecen visibles también en móvil; el usuario decide su posición. Las tarjetas muestran un resumen de hasta 100 caracteres; el panel conserva el texto completo.

## Notas independientes y guardado

Nota es una tarjeta independiente, sin marcador adicional. Flecha y Círculo admiten comentario opcional asociado al mismo objeto, con tarjeta movible por separado. Quitar comentario conserva la figura. Ocultar comentarios no oculta las notas. Las versiones existentes conservan sus textos y posiciones.

El guardado muestra estado en la cabecera, confirma el número de versión y limita a 15 segundos cada solicitud. Se distingue el POST confirmado de un fallo posterior al refrescar el historial. Un fallo de guardado conserva el borrador y permite reintentar; una respuesta JSON ilegible no se acepta como éxito. El timeout no garantiza que el servidor haya cancelado la escritura; el reintento idempotente existente resuelve ese caso.

## Nombres legibles

La carga permite un nombre opcional de hasta 100 caracteres. En el editor, Cambiar nombre guarda un título independiente del archivo original y de las anotaciones. Listado y encabezado usan ese título; si no existe, las fotografías muestran Fotografía clínica. El nombre original se consulta en un desplegable y se conserva en la descarga. Migración 0017, actualización limitada a display_name, RLS y permisos clínicos existentes. Cambiar nombre no genera una versión de anotaciones.

## Gestos y vista móvil

Zoom por pellizco de dos dedos entre 100% y 400%, centrado en el gesto. Un dedo desplaza el fondo en Seleccionar; Mover vista permite arrastrar desde cualquier zona. Tocar una anotación permite editarla. Al empezar un gesto de dos dedos se revierte la modificación provisional del primer dedo y se conserva el historial local. El zoom no modifica coordenadas guardadas.

En móvil, las tarjetas no seleccionadas se muestran compactas inicialmente. Tocar una tarjeta abre su contenido; Expandir tarjetas permite mostrar todas completas. El indicador de desarrollo de Next.js se desactiva mediante devIndicators:false.
