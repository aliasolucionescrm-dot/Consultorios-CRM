# Navegación de módulos

Expedientes, Tratamientos y Caja dejan de ser indicadores grises. Son pantallas de acceso a las herramientas existentes, sin duplicar expedientes ni crear módulos nuevos de datos.

- Expedientes: historia clínica, fotografías, consentimientos y recetas. Seleccionar herramienta y paciente abre la sección correspondiente de su ficha.
- Tratamientos: odontograma, plan y presupuestos, según permisos.
- Caja: pagos/recibos por paciente y acceso a cortes/arqueos.
- Reportes: acceso al reporte de caja disponible. Reportes generales clínicos, productividad e inventario siguen pendientes y se indica en pantalla.
- Inventario y Laboratorios: permanecen no interactivos, con etiqueta visible Pendiente.

Búsqueda progresiva de pacientes, hasta 20 resultados, filtros activo/inactivo/todos. Los accesos llevan a patients/:id/:section, conservan las rutas originales y enfocan la sección al cargar la ficha. Es la misma ficha y los mismos datos; no cambia la autorización del API ni agrega permisos. Se mantienen Corte de caja y otras rutas administrativas existentes para compatibilidad.

Expedientes requiere patients.view + clinical_records.view; Tratamientos patients.view y clinical_records.view o budgets.view; Caja permite patients.view+payments.view o cash_closures.view; Reportes requiere cash_closures.view. Las tarjetas se ajustan a permisos. También se aplica el control al escribir la ruta en la URL y en el buscador de acciones.

Pendiente: módulos completos de Inventario/Laboratorios, reportes generales y mejoras posteriores de organización interna de la ficha. Este bloque resuelve descubrimiento/acceso a funciones ya implementadas.
