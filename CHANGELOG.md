# Cambios

## 0.3.30 — Operación clínica y administrativa (01/10/2026)

- Remisiones a especialistas externos, seguimiento e informes versionados dentro del expediente.
- Sustitución de presupuestos con traslado de abonos y saldo a favor; devoluciones vinculadas al pago original y descontadas en caja/arqueo.
- Inventario operativo por sucursal: artículos, entradas, salidas, ajustes e historial, sin existencias negativas.
- Directorio y trabajos de laboratorio por paciente: solicitud, envío, recepción, entrega e informe.
- Migraciones 0039–0042, permisos y protección ante concurrencia. Alcances y pendientes en docs/OPERATIONS-EXPANSION.md.

## 0.3.19 — Accesos de módulos conectados

- Expedientes y Tratamientos con selección de herramienta y búsqueda de paciente.
- Caja reúne pagos/recibos y acceso a cortes/arqueos; Reportes muestra el reporte disponible.
- Inventario y Laboratorios identificados como pendientes.
- Navegación directa a secciones de la ficha y controles de permisos conservados.

## 0.3.18 — Arqueo de efectivo por moneda

- Fondo inicial, conteo y ajustes justificados sobre un corte guardado.
- Cálculo en servidor de esperado, faltante o sobrante; explicación requerida para diferencias.
- Correcciones versionadas, historial y reintentos sin duplicados; migración 0033.
- Anulaciones como referencia, sin descuento automático ni modificación de saldos.

## 0.3.17 — Corte de registros de caja

- Consulta por sucursal, responsable y fechas locales, separada por moneda/método.
- Pagos y anulaciones atribuidos a su fecha de registro, con detalle y neto.
- Copia revisada inmutable, folio, historial y reintentos sin duplicados; migración 0032.
- Permisos específicos; arqueo físico y bloqueo de periodos pendientes.

## 0.3.16 — Recibos imprimibles de pagos

- Vista previa y opción de imprimir/guardar PDF por pago, con folio, paciente, sucursal y método.
- Nuevos pagos conservan datos del recibo y saldo histórico; migración 0031.
- Consulta de estado antes de imprimir y marca visible de anulación.
- Notas internas excluidas; sin factura fiscal ni envío externo.

## 0.3.15 — Anticipos, abonos y saldo

- Registro de pagos recibidos por acuerdo, método y sucursal, con historial y saldo.
- Liquidación exacta y protección contra sobrepagos concurrentes y duplicados por reintento.
- Anulación de capturas erróneas con motivo, responsable e historial conservado.
- Permisos de Caja/Contabilidad y corrección reservada; migración 0030.
- Sustitución de acuerdos con pagos vigentes bloqueada hasta habilitar ajustes.

## 0.3.14 — Acuerdos e impresión de presupuestos

- Desglose imprimible y aceptación de la última versión por personal autorizado.
- Copia histórica de importes y datos del paciente/clínica, con folio y responsable.
- Nuevas propuestas conservan el acuerdo anterior hasta otra aceptación explícita.
- Historial de acuerdos sustituidos y reintentos sin duplicados; migración 0029.
- Sin registro de pagos ni firma electrónica.

## 0.3.13 — Decisiones y evidencia de consentimientos

- Vista imprimible del documento histórico y opción de guardar PDF desde el navegador.
- Aceptación con evidencia privada, rechazo y anulación con motivo, fecha y autor.
- Historial inmutable, descargas clínicas y reintentos sin duplicados; migración 0028.
- Sin verificación automática de firmas.

## 0.3.12 — Consentimientos por procedimiento

- Plantillas con categorías, estados y versiones inmutables.
- Preparación por paciente/procedimiento/profesional, búsqueda progresiva e historial.
- Copia del texto preservada aunque cambie o se retire la plantilla.
- Estado pendiente de aceptación; migración 0027.

## 0.3.11 — Revisión e impresión de recetas

- Revisión de campos faltantes y vista previa imprimible.
- Preparación con folio y fecha, copia fija pendiente de firma autógrafa.
- Reintentos sin duplicados y correcciones como nuevo borrador.
- Migración 0026; sin firma electrónica ni emisión firmada.

## 0.3.10 — Borradores de recetas

- Datos automáticos de paciente, clínica y profesional conservados por versión.
- Medicamentos e indicaciones desglosados, múltiples borradores e historial.
- Guardado idempotente, permisos clínicos y migración 0025.
- Solo preparación: sin emisión ni firma.

## 0.3.9 — Profesionales internos y externos

- Tipo de relación y filtro en el directorio, conservando registros previos sin clasificar.
- Datos profesionales para futura papelería y contactos externos sin sucursal local.
- Protección de citas pendientes al retirar sucursales.

## 0.3.8 — Expediente ampliado

- Condiciones clínicas en cinco categorías con color, estado y detalle.
- Diagnósticos general y por pieza/superficie separados de observaciones.
- Notas por cita con datos históricos preservados.
- Migración 0023 y compatibilidad con registros anteriores.

## 0.3.7 — Presupuestos iniciales

- Presupuestos desde una versión del plan, precios sugeridos, cantidades y descuentos.
- Total calculado en centavos, nombres personalizables e historial independiente.
- Permisos propios, RLS, guardado idempotente y control de concurrencia.
- Requisitos ampliados y preferencias de recordatorios/participación médica documentados.

## 0.3.6 — Servicios en el plan

- Búsqueda del catálogo al escribir y selección de servicios activos desde el plan.
- Pieza obligatoria según el servicio y opción de procedimiento manual.
- Nombre y requisitos conservados aunque se modifique el catálogo.

## 0.3.5 — Plan de tratamiento

- Procedimientos generales o por pieza, notas y estados de seguimiento.
- Versiones inmutables, permisos clínicos y protección de ediciones concurrentes.
- Migración 0021 y 79 pruebas aprobadas.

## 0.3.4 — Fotografías desde odontograma

- Visor de referencias dentro de la ficha, con anotaciones e historial en modo consulta.
- Borrador dental conservado y metadatos protegidos por permisos clínicos.

## 0.3.3 — Selección gráfica de superficies

- Esquema interactivo con zonas etiquetadas, selección por toque y teclado.
- Indicadores de observación y sincronización con el selector textual.

## 0.3.2 — Superficies y referencias fotográficas

- Observaciones separadas por superficie dental, compatibles con registros anteriores.
- Fotografía clínica opcional por observación, validada por paciente y organización.

## 0.3.1 — Odontograma manual

- Denticiones permanente y temporal, selección por pieza y observaciones editables.
- Borrador conservado al cambiar de pieza, versiones históricas y control de concurrencia.
- Migración 0020, acceso clínico y 77 pruebas aprobadas.

## 0.3.0 — Expediente clínico inicial

- Antecedentes, alergias y medicamentos con versiones inmutables.
- Notas de consulta con autor y fecha; historial paginado y acceso clínico.
- Control de concurrencia, idempotencia y migración 0019.

## 0.2.28 — Fotografía de perfil

- Carga con vista previa, reemplazo y retiro desde la ficha del paciente.
- Imagen privada separada de las fotografías clínicas, con control de concurrencia y permisos.

## 0.2.27 — Gestos móviles

- Pellizco para ampliar/reducir y desplazamiento táctil sobre el fondo, sin modificar anotaciones.
- Tarjetas compactas iniciales en móvil, expandibles por selección o control explícito.
- Indicador de desarrollo oculto.

## 0.2.26 — Nombre de fotografías y cursor

- Nombre descriptivo opcional al cargar y editable en el estudio; original conservado.
- Los botones deshabilitados ya no muestran cursor de espera. Guardar lo muestra únicamente mientras procesa.

## 0.2.25 — Notas y estado de guardado

- Notas independientes y comentarios opcionales de flechas/círculos, removibles sin borrar la figura.
- Confirmación visible, solicitudes acotadas y distinción entre fallo de guardado y fallo de actualización del historial.
- Conservación de borradores ante errores y ajuste de títulos largos.

## 0.2.24 — Comentarios sobre fotografías

- Tarjetas con comentario y pieza, vista previa al escribir y posición independiente guardada.
- Control para ocultar comentarios y vista de comentario seleccionado en pantallas pequeñas.

## 0.2.23 — Estudio de anotaciones

- Herramientas visibles, selección, arrastre y ajuste de extremos con tiradores táctiles.
- Panel de propiedades para comentarios y piezas; duplicado, eliminación, deshacer/rehacer y atajos.
- Guardado directo del comentario en edición, lista de anotaciones y vista adaptable a móvil.

## 0.2.22 — Soporte WebP

- Carga y anotación de fotografías WebP, conservando el original privado.
- Validación de firma y contenedor; migración 0016 y pruebas escritorio/móvil.

## 0.2.21 — Fotografías clínicas anotadas

- Editor de flechas, círculos, notas y pieza dental sobre PNG/JPEG privados.
- Zoom, original intacto, versiones inmutables y control de conflictos.
- Permisos clínicos separados de recepción, RLS y auditoría; migración 0015.

## 0.2.20 — Archivos en fichas de pacientes

- Selección, carga, listado paginado y descarga autenticada de adjuntos.
- Estados de error/progreso y reintento idempotente sin perder la selección.
- Almacenamiento local privado configurado; pruebas escritorio/móvil y build aprobados.

## 0.2.19 — API de adjuntos de pacientes

- Metadatos con RLS, carga idempotente y descarga autenticada con auditoría.
- Validación de nombre/formato/tamaño, límite de intentos e integridad al descargar.
- Migración 0014; 74 pruebas aprobadas. Panel de archivos aún pendiente.

## 0.2.18 — Base de almacenamiento privado

- Adaptador local cifrado con AES-GCM y contexto autenticado de organización/archivo.
- UUID para rutas, límite de 10 MiB, escritura exclusiva y configuración explícita.
- Tres pruebas nuevas; carga y descarga en fichas aún pendientes.

## 0.2.17 — Contexto de agenda persistente

- Conserva fecha, vista y sucursal por usuario/organización en la sesión de pestaña.
- Valida los valores guardados y prioriza la fecha al abrir una cita desde ficha/búsqueda.
- Etiqueta accesible del selector de sucursal corregida.

## 0.2.16 — Revisión de recepción

- Prueba del ciclo de atención con el rol Recepción y restricciones administrativas.
- Recorridos de reservas con recursos de prueba independientes.
- Matriz de fase 2 consolidada con alcances y pendientes actuales.

## 0.2.15 — Bloqueos visibles en calendario

- Eventos rojos no editables con detalle del recurso, periodo y motivo.
- Refresco al crear/liberar y límites que evitan calendarios incompletos.
- 66 pruebas de integración y recorridos E2E escritorio/móvil aprobados.

## 0.2.14 — Horarios de consultorios

- Turnos semanales editables desde Agenda, con permisos, versiones y auditoría.
- Validación conjunta de horarios de profesional y consultorio en reservas y sugerencias.
- Protección de reservas futuras, incluido tiempo de preparación.
- Migración 0013, 66 pruebas de integración y 2 recorridos E2E aprobados.

## 0.2.13 — Sugerencias de horarios

- Hasta 12 opciones por día con selección directa en reservas y reprogramaciones.
- Considera turnos, bloqueos, conflictos del paciente y recursos, y preparación.
- 65 pruebas de integración y recorridos E2E escritorio/móvil aprobados.

## 0.2.12 — Familiares vinculados

- Búsqueda de pacientes para vincular parentescos y navegación entre fichas.
- Relación inversa automática, duplicados prevenidos bajo concurrencia y retiro con motivo.
- RLS, permisos, auditoría y migración 0012; 64 pruebas de integración y 2 recorridos E2E aprobados.

## 0.2.11 — Próxima cita en la ficha

- Resumen de próxima cita futura en todas las sucursales y acceso a su día en agenda.
- Estados vacío, carga, error y actualización manual; permisos de pacientes y agenda.
- 63 pruebas de integración, build y dos recorridos E2E escritorio/móvil aprobados.

## 0.2.10 — Consultorios por profesional

- Asignación por sucursal desde Profesionales y filtrado al agendar.
- Validación de reservas, reprogramaciones y series; protección de citas pendientes.
- Versiones compartidas, auditoría y RLS.
- 62 pruebas de integración y dos recorridos E2E de catálogos aprobados.

## 0.2.9 — Servicios por profesional

- Configuración de todos los servicios o selección explícita desde Profesionales.
- Búsqueda filtrada al reservar y validación de reservas, movimientos y series.
- Protección de citas pendientes, versiones, RLS y auditoría.
- 61 pruebas de integración y dos recorridos E2E de catálogos aprobados.

## 0.2.8 — Citas recurrentes

- Series de 2–24 citas semanales o quincenales, conservando hora local y preparación.
- Validación de toda la serie en una transacción; error identifica la ocurrencia en conflicto.
- Reintentos idempotentes, pertenencia persistida, RLS y auditoría.
- 60 pruebas de integración y dos recorridos E2E de recurrencias aprobados.

## 0.2.7 — Tiempo entre pacientes

- Margen posterior configurable de 0–120 minutos por reserva.
- Ocupación de profesional/consultorio protegida en PostgreSQL, horarios y bloqueos.
- Preparación visible en calendario y detalle; conservación al reprogramar y en historial.
- 59 pruebas de integración y 4 E2E de agenda aprobadas.

## 0.2.6 — Agenda por horas y revisión de fase 2

- FullCalendar React 7.1.0 para día/semana por horas y mes.
- Arrastre con motivo y validación backend antes de persistir; conserva duración y recursos.
- Endpoint de eventos con límite explícito y aislamiento; matriz de pendientes de fase 2.
- 58 pruebas de integración y prueba real de arrastre con rechazo de conflictos aprobadas.

## 0.2.5 — Búsqueda global operativa

- Resultados agrupados para profesionales, consultorios, servicios y citas.
- Coincidencias sin acentos, permisos por entidad, RLS y auditoría sin texto buscado.
- Apertura de catálogo por ID y agenda por fecha/sucursal.
- 57 pruebas de integración y recorridos de búsqueda en escritorio/móvil aprobados.

## 0.2.4 — Calendario semanal y mensual

- Vistas Día/Semana/Mes con navegación y detalle diario.
- Conteos completos y hasta tres resúmenes por día, en la zona de la organización.
- Filtros buscables por profesional y consultorio.
- API por rango acotado, aislamiento y pruebas de escritorio/móvil.

## 0.2.3 — Disponibilidad

- Turnos semanales por profesional y sucursal, con descansos y días cerrados.
- Bloqueos por profesional/consultorio y liberación auditada con motivo.
- Validación transaccional al crear/reprogramar citas; protección de reservas existentes.
- Formularios y pruebas en escritorio/móvil; 55 pruebas de integración aprobadas.

## 0.2.2 — Agenda diaria

- Reservas por sucursal, búsqueda de pacientes y recursos, duración sugerida por servicio.
- Prevención de cruces de paciente/profesional/consultorio en PostgreSQL, incluida concurrencia.
- Zona horaria explícita, idempotencia, reprogramación versionada, estados e historial inmutable.
- RLS, permisos, auditoría y pruebas: 52 de integración y 8 E2E aprobadas.
- Horarios, bloqueos y vistas semanal/mensual pendientes.

## 0.2.1 — Catálogos operativos

- Profesionales separados de usuarios y empleados, con sucursales de atención.
- Consultorios por sucursal; servicios con duración, precios en centavos y requisitos.
- RLS, permisos, control de versiones y auditoría; historial inmutable de precios.
- Pruebas de API y formularios en escritorio/móvil.

## 0.2.0 — Pacientes, primer bloque de fase 2

- Directorio, registro, ficha general, edición y desactivación auditada.
- Folios transaccionales, creación idempotente y control de versión.
- Búsqueda tolerante y paginación por cursor; integración en Ctrl/Cmd+K.
- RLS de pacientes y pruebas contra acceso entre organizaciones.
- Seis pacientes ficticios; pruebas de interfaz en escritorio y móvil.

## 0.1.1 — 2026-09-28

- Separación de rol PostgreSQL de aplicación y migraciones, con privilegios mínimos probados.
- Correo transaccional cifrado con reintentos; estados visibles; aceptación de invitaciones para cuentas existentes.
- Pruebas de integración aisladas automáticamente y bootstrap de primera cuenta sin seed.
- Respaldo cifrado y ensayo de restauración que compara las 16 tablas y verifica permisos.
- Compose evita pasar secretos de migración a la API; SMTP productivo exige TLS.

## 0.1.0 — 2026-09-28

- Base fase 1: Next.js + NestJS + PostgreSQL, migración versionada y seed ficticio.
- Autenticación, sesiones, MFA, recuperación por correo y protección de acceso.
- Organizaciones, sucursales, membresías, roles personalizados e invitaciones.
- Auditoría protegida y permisos validados en backend.
- Interfaz ALIA DENTAL responsive y navegación de acciones.
- Pruebas de integración y E2E; configuración Docker/Nginx y documentación técnica.
- Fuera de alcance: todas las funcionalidades operativas y clínicas de fases 2–5.








## 0.3.20 — Documento de corte y arqueo (01/10/2026)

- Vista previa e impresión/PDF desde navegador para cortes guardados, con movimientos completos y monedas separadas.
- Selección de último arqueo o versión histórica, folios, responsables, ajustes y diferencias; actualización antes de imprimir.
- Sin cambios al esquema, pagos ni saldos. Permisos de consulta existentes.

## 0.3.21 — Participación profesional (01/10/2026)

- Asignación de doctor interno/externo y porcentaje sobre el total del acuerdo aceptado; acceso desde Caja y ficha del paciente.
- Historial inmutable, conservación del nombre, redondeo exacto a centavos, validación de versión y reintentos idempotentes.
- Permisos propios para consulta/gestión, migración 0034 con RLS. Los pagos al doctor quedan para el siguiente bloque.

## 0.3.22 — Pagos al profesional (01/10/2026)

- Abonos, liquidación del saldo, método, sucursal, referencia e historial por paciente/asignación.
- Anulación auditada de capturas erróneas, controles contra sobrepago concurrente y bloqueo de cambios de acuerdo/participación con pagos vigentes.
- Migración 0035, permisos propios, RLS e idempotencia. Integración automática de egresos con caja todavía pendiente.

## 0.3.23 — Egresos profesionales en caja (01/10/2026)

- Nuevos cortes incluyen pagos al doctor y anulaciones, separados por moneda/método y fecha del evento.
- Arqueo descuenta pagos profesionales en efectivo; exige revisar egresos y ajustes. Las anulaciones no son reintegros automáticos.
- Cortes y arqueos históricos conservados, formato de impresión actualizado y filtro por responsable del registro.

## 0.3.24 — Recibos de pagos al doctor (01/10/2026)

- Vista previa e impresión/PDF desde el historial, con folios y datos de la participación.
- Nueva consulta de estado antes de imprimir, marca de anulación y saldo histórico solo para registros compatibles no anulados.
- Migración 0036 conserva clínica, autor y saldo al registrar nuevos pagos. Acceso por permisos financieros existentes.

## 0.3.25 — Reporte profesional (01/10/2026)

- Consulta por doctor y periodo, con búsqueda de activos/inactivos y acceso desde Reportes/Caja.
- Movimientos por fecha del evento y saldo actual de asignaciones vigentes separados por moneda; detalle paginado y recibos.
- Lectura consistente, control de permisos/RLS y límite explícito sin truncar totales. Sin nuevas migraciones.

## 0.3.26 — Impresión del reporte profesional (01/10/2026)

- Vista previa A4 e impresión/PDF de la consulta revisada, con fecha de consulta y todos los movimientos.
- Periodo y saldo actual separados; cambios de filtros cierran el documento anterior.

## 0.3.27 — Preferencias de recordatorios (01/10/2026)

- Correo y WhatsApp por paciente, revisión de contactos, historial y desactivación de canales; migración 0037.
- Anticipación fija de 24 horas según indicación del usuario; vista previa desde las citas actuales, con contactos cambiados y horarios vencidos identificados.
- Envíos automáticos y enlaces de confirmación aún no habilitados.

## 0.3.28 — Cola persistente de recordatorios (01/10/2026)

- Preparación automática por cita, versión, preferencias y canal; migración 0038.
- Invalidación transaccional al cambiar citas, contactos o preferencias, con historial y protección contra duplicados de preparación.
- Consulta de cola en la ficha, estados preparado/invalidado/vencido y distinción explícita de envíos deshabilitados.
- Proveedores y trabajador de entrega siguen pendientes.

## 0.3.29 — WhatsApp con mensaje precargado (01/10/2026)

- Apertura manual desde la ficha, con próximas citas, número revisado y borrador editable/restablecible.
- Validación de autorización, contacto y cita antes de generar el enlace; bloqueo de borradores desactualizados.
- Compatible con citas de menos de 24 horas sin cola. Auditoría de preparación, sin marcar envío ni confirmar automáticamente.
- Decisión del usuario: posponer proveedor y automatización; no requiere nuevas credenciales ni migración.
