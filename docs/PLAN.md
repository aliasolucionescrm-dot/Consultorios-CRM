# Plan y criterios

1. Inspección: repositorio vacío, Node disponible, sin npm en PATH ni Docker/PostgreSQL.
2. Fundamentos: monorepo, dependencias justificadas, PostgreSQL local real, esquema y migraciones reproducibles.
3. Acceso: login, sesiones, recuperación, MFA, límites, roles y tenants.
4. Administración: organización, sucursales, equipo, invitaciones, roles personalizados, auditoría.
5. Experiencia: identidad visual, layout responsive, estados vacíos, errores, command palette.
6. Verificación: lint, typecheck, compilación, integración PostgreSQL, E2E escritorio/móvil, inspección visual.
7. Infraestructura y documentación: Compose, Nginx, variables, backups y riesgos.

No comenzar fase 2 antes de revisar el resultado de fase 1. La ejecución local y los controles probados no sustituyen validación del despliegue productivo.

## Cierre técnico — avance 28/09/2026

- Completado: usuario DB restringido, credenciales separadas y pruebas con permisos reales.
- Completado: cola de correo cifrada y transaccional, reintentos, cancelación y estado visible.
- Completado: pruebas en base temporal propia y bootstrap de la primera cuenta.
- Completado: respaldo cifrado y restauración local con 16 tablas verificadas.
- Pendiente de infraestructura externa: Docker ejecutado en host compatible, dominio/TLS y proveedor SMTP productivo; recuperación remota completa y revisión independiente de seguridad.

## Fase 2 — avance

Primer bloque implementado: pacientes (alta, ficha administrativa, edición, búsqueda paginada, permisos, RLS, auditoría y pruebas). Búsqueda de pacientes integrada en Ctrl/Cmd+K.

Segundo bloque implementado: catálogos base de profesionales, consultorios y servicios con estado, RLS, permisos, auditoría, versiones e historial de precios. Alcance en CATALOGS.md.

Tercer bloque implementado: agenda diaria con reservas, reprogramación, estados, historial y prevención de conflictos concurrentes. Alcance y límites en APPOINTMENTS.md.

Cuarto bloque implementado: horarios semanales por profesional/sucursal y bloqueos por profesional/consultorio, con validación transaccional de reservas. Alcance en AVAILABILITY.md.

Quinto bloque implementado: vistas semanal/mensual y filtros por profesional/consultorio, con detalle diario. Alcance en CALENDAR.md.

Sexto bloque implementado: búsqueda global de profesionales, consultorios, servicios y citas, además de pacientes y acciones. Alcance en SEARCH.md.

Revisión realizada en PHASE2-REVIEW.md. Calendario sustituido por FullCalendar con cuadrícula horaria y arrastre sujeto a motivo y validación backend.

Tiempo entre pacientes implementado por reserva, integrado con horarios, bloqueos y exclusiones de recursos. Ver APPOINTMENT-BUFFERS.md.

Recurrencias semanales/quincenales implementadas con validación atómica e idempotencia; edición individual. Ver RECURRENCE.md.

Servicios por profesional implementados con filtrado de agenda, validación transaccional y protección de citas pendientes. Ver PROFESSIONAL-SERVICES.md.

Asignación de consultorios por profesional implementada; ver PROFESSIONAL-ROOMS.md.

Próxima cita y acceso a la agenda implementados en la ficha; ver PATIENT-NEXT-APPOINTMENT.md.

Relaciones familiares implementadas con vínculo bidireccional, prevención de duplicados y retiro auditado. Ver PATIENT-RELATIVES.md.

Sugerencias de horarios implementadas; ver APPOINTMENT-SUGGESTIONS.md.

Horarios propios de consultorios implementados; ver ROOM-SCHEDULES.md.

Bloqueos visibles en calendario implementados; ver CALENDAR-BLOCKS.md.

Revisión integral de recepción realizada y matriz actualizada en PHASE2-REVIEW.md.

Navegación persistente de fecha, sucursal y vista implementada; ver AGENDA-NAVIGATION.md.

Base de almacenamiento privado local cifrado implementada y probada; ver PRIVATE-STORAGE.md. No hay carga de archivos habilitada todavía.

Metadatos con RLS y API autenticada de adjuntos administrativos implementados; ver PATIENT-ATTACHMENTS-API.md. Configuración de almacenamiento requerida.

Panel de carga y descarga de adjuntos implementado y almacenamiento local configurado; ver PATIENT-ATTACHMENTS-UI.md.

Fotografías clínicas con anotaciones manuales implementadas a petición del usuario; ver CLINICAL-PHOTOS.md. Fotografía de perfil implementada; ver PATIENT-PROFILE-PHOTO.md. La fase 2 completa sigue pendiente según la matriz de revisión.

Expediente clínico inicial implementado: antecedentes, alergias, medicamentos y notas con historial; ver CLINICAL-RECORD.md. Próximo bloque clínico: odontograma manual, conservando pendientes operativos de fase 2.

Odontograma manual por pieza implementado; ver ODONTOGRAM.md. Siguiente ampliación clínica propuesta: observaciones por superficie dental y vinculación explícita con fotografías.

Selector gráfico esquemático de superficies implementado, con acceso por teclado y selección textual alternativa.

Consulta de fotografías vinculadas desde odontograma implementada. Próximo bloque clínico propuesto: plan de tratamiento manual por pieza, separado de las observaciones y del presupuesto.

Plan de tratamiento manual implementado; ver TREATMENT-PLAN.md. Próxima ampliación propuesta: vincular procedimientos al catálogo de servicios conservando el nombre registrado en cada versión, antes de presupuestos.

Vinculación al catálogo implementada con búsqueda progresiva, pieza obligatoria según servicio y nombre histórico conservado. Próximo bloque propuesto: presupuestos a partir del plan, con importes y versiones separados del registro clínico.

Presupuestos iniciales implementados desde el plan con desglose e historial; ver BUDGETS.md. Nuevos requisitos y preferencias confirmadas registrados en EXPANSION-REQUIREMENTS.md: ambos canales de recordatorio y porcentaje del doctor sobre el total del tratamiento. Siguiente bloque propuesto: condiciones clínicas por color y texto, diagnóstico explícito y notas por cita; después recetas y la ampliación financiera/comunicación según dependencias.

Ampliación registrada: doctores internos y especialistas externos, remisiones e informes, agenda general con filtros por relación/especialidad, centro de papelería y consentimientos por procedimiento, liquidaciones del paciente y del profesional diferenciadas. Ver EXPANSION-REQUIREMENTS.md. El usuario confirmó que «Ando» se refiere a endodoncia.

Condiciones por color/texto, diagnóstico general/por pieza/superficie y notas vinculadas a citas implementados; ver CLINICAL-EXPANSION.md. Próximo bloque: relación de profesionales internos/externos y datos del responsable, como base de recetas, referencias y papelería.

Relación de profesionales internos/externos implementada en el directorio con datos profesionales y contactos externos sin sucursal; ver PROFESSIONAL-RELATIONSHIPS.md. Próximo bloque propuesto: borradores de recetas con datos automáticos del paciente/profesional y desglose de medicamentos; emisión y papelería requieren su propio flujo verificable.

Borradores de recetas implementados con datos automáticos y medicamentos desglosados; ver PRESCRIPTION-DRAFTS.md. Emisión/firma y documento imprimible pendientes. Próximo bloque: revisión de datos, permisos del responsable y flujo de emisión de papelería, antes de presentar recetas como utilizables.

Revisión y preparación imprimible de recetas implementadas, con campos faltantes, folio y copia inmutable pendiente de firma autógrafa; ver PRESCRIPTION-PREPARATION.md. Emisión electrónica firmada pendiente. Próximo bloque propuesto: consentimientos por paciente y procedimiento con plantillas versionadas, antes de conectar pagos y recordatorios.

Consentimientos iniciales implementados: plantillas propias versionadas y preparación por paciente/procedimiento/profesional; ver CONSENTS.md. Siguiente bloque: impresión y registro de evidencia de aceptación, rechazo o anulación, sin confundir preparación con firma.
Consentimientos imprimibles y decisiones con evidencia privada implementados; ver CONSENTS.md. Siguiente bloque propuesto: aceptación e impresión de presupuestos conservando la versión pactada, antes de registrar anticipos, parcialidades y saldo. Participación del doctor sobre total del tratamiento permanece como requisito; reglas de distribución y liquidación todavía pendientes.
Presupuestos: aceptación por versión e impresión implementadas; el acuerdo se conserva al crear nuevas propuestas y solo cambia mediante otra aceptación. Próximo bloque: anticipos y abonos vinculados al acuerdo, saldo e historial de movimientos. No se registran pagos todavía; definir ajustes y sustitución del presupuesto con pagos existentes antes de habilitarlos.
Anticipos, abonos y liquidación registrados contra el acuerdo, con saldo e historial, implementados; ver PAYMENTS.md. Anulación de captura errónea conserva el original. Sustituir un acuerdo con pagos vigentes queda bloqueado hasta implementar ajustes financieros. Próximo bloque propuesto: recibos de pago imprimibles; después corte de caja por sucursal/usuario/periodo. Devoluciones, ajustes y participación del doctor siguen pendientes.
Recibos imprimibles implementados, con saldo histórico para pagos nuevos y marca de anulación consultada antes de imprimir; ver PAYMENTS.md. Siguiente bloque: corte de caja por sucursal, responsable y periodo, separado por método y moneda, conservando anulaciones y sin mezclar cobros con devoluciones todavía no soportadas.
Corte inicial por sucursal/responsable/periodo implementado con separación por moneda/método, eventos de pago/anulación e historial inmutable; ver CASH-CLOSURES.md. Es corte de registros, sin bloqueo de periodo ni arqueo físico. Próximo bloque: arqueo de efectivo y diferencias por moneda, definiendo fondo inicial/ajustes antes de equiparar registros con efectivo esperado. Impresión/exportación del corte pendiente.
Arqueo manual por moneda implementado sobre corte guardado: fondo inicial, efectivo contado, ajustes justificados, diferencias e historial de correcciones; ver CASH-CLOSURES.md. No modifica pagos ni saldos. Próximo bloque propuesto: impresión del corte y su arqueo con folios, responsables y diferencias, para revisión administrativa. Turnos, egresos reales, devoluciones y liquidación profesional siguen pendientes.
Prioridad solicitada por el usuario: navegación reorganizada antes de ampliar módulos. Expedientes, Tratamientos, Caja y Reportes tienen accesos útiles a funciones existentes, respetando permisos; Inventario/Laboratorios muestran Pendiente. Ver MODULE-NAVIGATION.md. Siguiente paso funcional mantiene impresión del corte/arqueo; después retomar módulos pendientes según dependencias del plan.
