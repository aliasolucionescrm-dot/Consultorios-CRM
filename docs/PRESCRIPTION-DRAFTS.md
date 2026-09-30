# Borradores de recetas

Ficha del paciente → Borradores de recetas. Crear un borrador independiente, buscar doctor activo por nombre, capturar hasta 20 medicamentos y guardar versiones. Cada medicamento tiene nombre obligatorio y presentación, dosis, vía, frecuencia, duración e indicaciones opcionales durante preparación. No hay sugerencias de medicamentos ni dosis. Nombre de borrador e indicaciones generales editables.

Se completan en servidor los datos actuales del paciente (nombre, expediente y nacimiento), clínica y profesional seleccionado. Se conservan copias por versión, autor y fecha; modificar el catálogo no altera versiones previas. Cada nuevo guardado actualiza esas copias en la nueva versión. La cuenta que captura y el doctor seleccionado se distinguen. Seleccionar doctor no es una firma ni acredita facultad de prescripción.

Todos los registros se presentan como borradores sin emitir ni firmar. No hay impresión, dispensación, envío ni receta válida. La emisión requiere un flujo posterior con identidad del firmante, campos obligatorios y validación aplicable. No se emite una receta desde este bloque.

API patients/:id/prescription-drafts GET paginado 20 versiones, GET professionals búsqueda de hasta 20 profesionales, POST versionado con request_id. Lectura patients.view + clinical_records.view; escritura añade clinical_records.edit y paciente activo. Profesional activo de la misma organización. RLS forzada, SELECT/INSERT únicamente, auditoría sin medicamentos. Reintentos idénticos no duplican; editar una versión antigua entra en conflicto. Migración 0025.

Límites: historial paginado de todas las versiones, sin filtro por borrador; borrador en memoria con aviso al recargar, navegación interna puede descartarlo. Datos profesionales parciales admitidos porque solo es preparación. No incluye validación de interacciones ni evaluación clínica automática.

## Actualización: revisión e impresión

Revisión de campos faltantes, vista imprimible y preparación inmutable para firma autógrafa implementadas. Ver PRESCRIPTION-PREPARATION.md. La preparación no equivale a emisión firmada; los límites de firma/dispensación descritos arriba permanecen.
