# Odontograma manual inicial

Ficha del paciente → Odontograma. Selector Permanente/Temporal, cuadrantes identificados desde la perspectiva del paciente y botones con número FDI. Se conserva una observación libre de hasta 1500 caracteres por pieza; las piezas con observación se señalan sin asignar un diagnóstico automático. Cambiar de pieza o dentición conserva el borrador. Guardar incluye el texto en edición. Vaciarlo retira la observación de la versión actual.

Historial inmutable con autor y fecha; selector de últimas 25 versiones. Versiones anteriores de solo lectura. Migración 0020, RLS forzada, SELECT/INSERT únicamente, acceso patients.view más clinical_records.view para lectura y clinical_records.edit para guardar. Pacientes inactivos no admiten escrituras. Versión optimista, serialización por paciente e idempotencia de reintentos idénticos. Auditoría sin contenido de las notas.

Alcance: esquema por pieza, no por superficie. Sin diagnósticos codificados, símbolos terapéuticos, periodontograma, plan de tratamiento ni vinculación automática de fotografías. Borradores en memoria con aviso al recargar; navegación interna puede descartarlos. Cambiar a otra dentición no elimina observaciones de la anterior.

## Observaciones por superficie y fotografías

Cada pieza admite observaciones independientes para pieza completa, mesial, distal, vestibular, palatina/lingual y oclusal/incisal. El selector utiliza etiquetas combinadas para ambas arcadas y tipos de pieza. Los registros antiguos sin superficie se interpretan como pieza completa. Cada observación puede vincular una fotografía clínica del mismo paciente, elegida de una lista paginada. La descarga usa autenticación existente; el vínculo apunta al original y no a una versión de anotaciones. No hay marcado gráfico por caras ni diagnóstico codificado. La eliminación de una observación retira su vínculo en la nueva versión; las anteriores permanecen.

## Selector gráfico de superficies

Al seleccionar una pieza se muestra un esquema de cinco zonas con etiquetas explícitas, más Pieza completa. Cada zona se puede activar con clic, toque, Enter o espacio. Comparte el mismo borrador y selector textual existente. Azul identifica selección; punto y fondo verde indican observaciones. Es un selector esquemático sin orientación anatómica, no una representación morfológica del diente. Las versiones históricas permiten recorrer superficies sin editar.

## Consulta de fotografía vinculada

Ver fotografía vinculada abre el visor existente en modo consulta dentro del odontograma, con original, anotaciones, zoom e historial fotográfico. Abrir/cerrar no altera el borrador dental. Cambiar pieza, superficie, foto o versión cierra la referencia anterior. El visor inicia en la versión actual de anotaciones de la foto; no representa una instantánea de la fecha del odontograma. La descarga sigue disponible. El endpoint de metadatos verifica organización, paciente y permisos clínicos y audita la consulta.
