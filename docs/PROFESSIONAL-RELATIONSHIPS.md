# Relación de profesionales con el consultorio

Catálogos → Profesionales. Tipo de relación: Sin clasificar, Doctor interno o Especialista externo, con filtro de directorio. La migración 0024 conserva todos los registros anteriores como Sin clasificar; no infiere relaciones laborales ni verifica credenciales.

Datos nuevos: título profesional (80 caracteres), institución de formación (160), consultorio/institución externa (160) y dirección profesional (500). Se conservan especialidad, cédulas, correo, teléfono y asignaciones. Son datos declarados para futura papelería; no se emiten recetas ni se verifica una cédula automáticamente.

Un externo con sucursales puede atender en la agenda existente. Sin sucursales queda como contacto externo y no está disponible para reservar atención local. Internos y registros sin clasificar requieren al menos una sucursal. El formulario explica esta diferencia y permite desmarcar sucursales. No crea cuenta de usuario ni concede acceso a expedientes.

Retirar sucursales se rechaza si hay citas pendientes que aún las requieren. La operación comparte el bloqueo transaccional de disponibilidad con la agenda. Se mantienen permisos catalogs.view/manage, RLS y edición por versión; búsqueda descarta respuestas anteriores al cambiar filtros.

Pendiente: remisiones e informes, citas fuera de la clínica, filtros interno/externo en el calendario general, vigencia e historial completo de la relación, asociación profesional-cuenta, honorarios, liquidaciones y documentos emitidos. La clasificación y los datos actuales no son una contratación ni una validación profesional.
