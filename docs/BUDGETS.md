# Presupuestos desde el plan

Ficha del paciente → Presupuestos → Preparar desde el plan actual. Copia procedimientos no cancelados de una versión guardada del plan. Sugiere precios actuales de servicios activos en la moneda de la organización; procedimientos manuales, servicios desactivados o con otra moneda requieren captura de precio. Se pueden retirar renglones sin alterar el plan clínico.

Nombre personalizable, cantidad entera 1–100, precio unitario hasta 1,000,000 y descuento monetario por renglón. Entrada con punto decimal y hasta dos decimales; persistencia y cálculo en centavos, total recalculado en servidor. No se calculan impuestos ni conversiones de moneda en este bloque. Se muestran total del borrador y desglose guardado.

Un presupuesto vigente por paciente con versiones inmutables y últimas 25 consultables. Editar conserva la versión del plan de origen y los precios. Preparar desde el plan actual permite renovar el contenido expresamente. Los cambios del plan o catálogo no modifican un presupuesto guardado. Historial con fecha y autor; una versión anterior es de consulta. Reintentos idempotentes mediante request_id y control de concurrencia por versión.

Permisos: patients.view y budgets.view para consultar. Preparación/guardado requieren budgets.manage y clinical_records.view; guardado también budgets.view. Nuevos permisos asignados a Propietario, Administrador y Odontólogo; las restricciones de patients.view siguen aplicando. Roles personalizados configurables. RLS forzada; usuario de aplicación solo SELECT/INSERT en patient_budget_versions. Auditoría sin desglose monetario ni clínico.

Pendiente: alternativas independientes, vigencia, evidencia firmada/verificada del acuerdo, anulación del acuerdo, anticipos, parcialidades, recibos, corte de caja y participación del doctor. No se registra ningún pago al guardar. Borrador en memoria con aviso al recargar; navegación interna puede descartarlo. Migración 0022.

## Documento y aceptación

Ver documento y aceptación muestra la versión seleccionada con paciente, clínica, procedimientos, cantidades, precios, descuentos y total en la moneda registrada. Imprimir / guardar PDF usa el diálogo de impresión del navegador. Propuestas muestran datos actuales del paciente/clínica; al aceptar se guarda una copia completa de dichos datos junto con el presupuesto. Todas las cadenas se escapan y el marco impide scripts.

Solo puede registrarse aceptación de la última versión, con budgets.manage, patients.view y budgets.view. El personal declara quién acepta, su relación con el paciente y observaciones; confirma que aceptó el desglose y total. Se conserva folio, fecha/hora del registro y usuario responsable. No es firma electrónica, consentimiento clínico, factura ni pago; no se carga evidencia firmada en este bloque.

Una aceptación por versión, inmutable. Nuevos borradores/versiones no sustituyen automáticamente el acuerdo vigente. Registrar aceptación de una versión posterior lo sustituye expresamente, conservando las copias anteriores. Las impresiones consultadas posteriormente identifican acuerdos sustituidos. Ver versión acordada permite recuperar el acuerdo vigente incluso si está fuera de las últimas 25 versiones del selector. Para corregir un acuerdo, crear y aceptar otra versión; anulación sin sustitución pendiente.

Migración 0029, budget_acceptances con RLS y permisos SELECT/INSERT. Bloqueo compartido con guardado de presupuestos evita aceptar mientras otra sesión cambia la última versión. request_id/hash permite reintentos idénticos sin duplicados, aun después de nuevas propuestas; otra solicitud para una versión ya aceptada devuelve conflicto. Auditoría de consulta y aceptación sin datos de importes/firmantes. El presupuesto aceptado sigue disponible si cambian los datos de paciente, clínica o catálogo.

Datos de aceptación sin guardar permanecen en memoria al fallar; cerrar/actualizar requiere descartar y recargar advierte. Cambiar de módulo puede descartarlos. Las copias ya impresas reflejan el estado consultado en ese momento y no se actualizan fuera del sistema.
Pagos vinculados implementados; ver PAYMENTS.md. Un acuerdo con pagos vigentes no puede sustituirse por otra aceptación hasta habilitar ajustes financieros. La propuesta nueva puede prepararse sin afectar el acuerdo existente.
