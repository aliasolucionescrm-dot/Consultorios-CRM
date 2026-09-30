# Expediente clínico inicial

En la ficha del paciente, personal con patients.view y clinical_records.view ve el resumen e historial. Para escribir requiere además clinical_records.edit y paciente activo. Recepción no recibe estos permisos por su rol.

Resumen: estado de alergias (sin verificar, no refiere o reportadas), detalle de alergias, antecedentes y medicamentos en texto libre. Cada cambio genera una versión inmutable con autor y fecha. Notas de consulta: entradas inmutables; correcciones mediante una nueva nota aclaratoria. Fecha de registro del servidor, sin fecha retroactiva ni firma electrónica.

Migración 0019, RLS forzada, permisos de SELECT/INSERT únicamente, control de versión para antecedentes, solicitudes idempotentes y auditoría sin texto clínico. Historial paginado de 20 entradas.

Alcance: documentación manual inicial. No incluye odontograma, prescripciones, diagnósticos codificados, firma/cierre clínico ni vinculación directa de notas a una cita. El texto de una nota puede referenciar una consulta anterior, pero la fecha mostrada corresponde al registro. El borrador permanece en pantalla ante errores; no se almacena en el navegador. Recargar advierte sobre edición; la navegación interna puede descartarla.
