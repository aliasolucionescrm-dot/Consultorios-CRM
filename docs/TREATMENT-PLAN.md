# Plan de tratamiento

Ficha → Plan de tratamiento. Permite añadir y editar hasta 100 procedimientos en texto libre, cada uno con pieza FDI opcional, notas y estado Propuesto/En curso/Realizado/Cancelado. Aplicar al plan actualiza el borrador; Guardar plan registra una versión. Para retirar un procedimiento se marca Cancelado. Los estados son declarados por el profesional, sin ejecución automática.

Versiones inmutables, historial con autor y fecha y selector de últimas 25 versiones. Las versiones históricas son de solo lectura. Control de concurrencia y reintento idéntico idempotente. Migración 0021, RLS forzada y SELECT/INSERT únicamente. Lectura con patients.view y clinical_records.view; escritura requiere además clinical_records.edit y paciente activo. Auditoría sin detalle clínico.

Catálogo: Elegir del catálogo abre una búsqueda mientras se escribe, con hasta 20 servicios activos por consulta. Al seleccionar se completa el título y se indica si la pieza es obligatoria. Se puede personalizar el título o convertir el procedimiento a manual. El vínculo conserva el nombre y el requisito de pieza registrados, aunque el servicio cambie o se desactive. Los vínculos nuevos validan organización, estado y requisitos; los existentes conservan su historial. El selector clínico expone únicamente ID, nombre y requisito de pieza, sin precios ni costos.

Alcance: un plan vigente por paciente, sin aprobación del paciente, presupuesto, cobro, agenda ni fechas individuales de realización. El historial conserva cuándo se registró cada cambio, no una fecha clínica retroactiva. Borrador en memoria con aviso al recargar; navegación interna puede descartarlo. La vinculación al catálogo utiliza campos opcionales del JSON; no requiere otra migración.
