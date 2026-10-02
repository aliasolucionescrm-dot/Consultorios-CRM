# Verificación de la entrega

Recurrencias: migración 0009 aplicada. 60 pruebas de integración aprobadas, incluido rollback de serie y reintentos concurrentes. Dos E2E aprobadas en escritorio/móvil; tipos, lint y build correctos. Alcance en RECURRENCE.md.

Tiempo entre pacientes: migración 0008 aplicada. 59 pruebas de integración y 4 E2E de agenda aprobadas en escritorio/móvil, incluidos márgenes persistidos, cruces, horarios, bloqueos e historial. Tipos, lint y build correctos. Alcance en APPOINTMENT-BUFFERS.md.

Agenda por horas: 58 pruebas de integración aprobadas. Arrastre de escritorio verificado con rechazo de conflicto y persistencia de movimiento válido en zona de organización. Build y lint correctos. Revisión de alcance en PHASE2-REVIEW.md; no equivale al cierre completo de fase 2.

Actualización de búsqueda global: 57 pruebas de integración y 2 E2E focalizadas aprobadas. Verificados permisos, aislamiento, acentos, comodines y navegación a catálogos/citas. Tipos, lint y build correctos; captura móvil inspeccionada. Alcance en SEARCH.md.

Actualización de calendario: 56 pruebas de integración aprobadas, dos E2E de navegación semanal/mensual y filtros aprobadas en escritorio/móvil. Build, tipos API/web y lint correctos. Alcance y límites en CALENDAR.md.

Actualización de disponibilidad: migración 0007 aplicada. 55 pruebas de integración y 6 E2E focalizadas en agenda/disponibilidad aprobadas. Tipos, lint y build correctos. Revisión visual móvil y ajuste de barra de acciones. Detalles y límites en AVAILABILITY.md.

Actualización de agenda diaria: migración 0006 aplicada. 52 pruebas de integración y 8 E2E aprobadas, con creación, reprogramación, historial y cancelación en escritorio/móvil. Compilación API/Next y tipos API/web correctos. Captura móvil inspeccionada. npm audit: 0 vulnerabilidades conocidas al agregar Temporal. Alcance y límites en APPOINTMENTS.md. Los párrafos siguientes corresponden a entregas anteriores.

Actualización de catálogos: migración 0005 aplicada. Suite ampliada a 42 pruebas de integración y 6 E2E aprobadas (fundamentos, pacientes y catálogos en escritorio/móvil). Lint, tipos y build correctos. Catálogos ficticios cargados e interfaz móvil inspeccionada. Profesionales, consultorios y servicios base implementados; agenda pendiente. Las secciones siguientes conservan el registro de verificaciones anteriores.

Ejecutada el 28 de septiembre de 2026 en Windows con Node 24 y PostgreSQL 17 local real.

- Migración inicial aplicada; seed ficticio aplicado.
- TypeScript API/frontend/base: correcto.
- ESLint: correcto.
- Build API y Next.js de producción: correcto.
- Integración: 22 pruebas aprobadas, con permisos mínimos reales, SMTP local, reintentos, aceptación y revocación de invitaciones y transacciones de cola de correo. La suite se ejecuta en una base temporal propia.
- Playwright Chromium: 2 pruebas aprobadas, escritorio y móvil. Login, configuración, sesiones, command palette en escritorio, logout y ausencia de desbordamiento horizontal.
- Capturas de inicio escritorio/móvil inspeccionadas visualmente.
- Dependencias: npm audit sin vulnerabilidades conocidas en la revisión realizada.

- Restauración verificada: snapshot consistente, archivo custom cifrado AES-256-GCM, restauración en base temporal, conteos y hashes de 16 tablas iguales, lectura permitida y borrado de auditoría denegado para alia_runtime. Evidencia local: `.local/backups/alia_restore_7f754571ed6a.json`.

No verificado: ejecución Docker, TLS real, entrega a proveedor SMTP externo, recuperación de un host completo, pruebas de carga, auditoría externa de seguridad y compatibilidad Safari/Firefox. El entorno local de correo es solo para desarrollo.

## Bloque de pacientes

Migración 0004 aplicada y seed ficticio ejecutado. Suite ampliada: 34 pruebas de integración aprobadas y 4 E2E aprobadas (fundamentos y pacientes en escritorio/móvil). Typecheck y lint correctos. No se introdujeron datos clínicos reales. Profesionales, consultorios, servicios y agenda siguen pendientes.

## UX de recepción

Autocompletado y alta rápida: 4 E2E de agenda aprobadas en escritorio/móvil; tipos, lint y build correctos. Se comprobó conservación de horario/recursos al registrar al paciente y reserva posterior. Sin cambios al backend de reservas.

## Servicios por profesional — 28 septiembre 2026

Migración 0010 aplicada. API/web TypeScript, ESLint y build aprobados. Suite aislada: 61 pruebas. Playwright catálogos: escritorio y móvil, 2 aprobadas, configuración persistida y revisión visual móvil. Se verificaron aislamiento entre organizaciones, versiones obsoletas, protección de citas pendientes, filtrado de opciones y rechazo de reservas/series no habilitadas.

## Consultorios por profesional — 28 septiembre 2026

Migración 0011 aplicada. TypeScript API/web, ESLint y build aprobados. Suite aislada: 62 pruebas. Playwright catálogos: escritorio y móvil, 2 aprobadas; configuración persistida y revisión visual móvil. Integración cubre aislamiento, permisos, versiones, protección de citas pendientes, filtrado y rechazo de reservas, reprogramaciones y series incompatibles.

## Próxima cita — 28 septiembre 2026

63 pruebas aisladas aprobadas; selección cronológica, cancelación, ausencia, aislamiento y permisos. Build y ESLint aprobados. Playwright patient-next: 2 aprobadas en escritorio/móvil; navegación a fecha y sucursal, retorno después de cancelar, sin desbordamiento móvil. Captura móvil revisada.

## Familiares vinculados — 28 septiembre 2026

Migración 0012 aplicada. 64 pruebas de integración aisladas aprobadas: parentesco inverso, duplicados concurrentes, autorrelación, aislamiento, permisos, retiro con motivo y versión, y nueva vinculación. TypeScript API/web, ESLint y build aprobados. Playwright relatives: 2 recorridos aprobados en escritorio/móvil, alta, navegación inversa y retiro en ambas fichas. Captura móvil revisada. Se corrigieron claves de React duplicadas entre las secciones familiares y próxima cita durante la verificación.

## Sugerencias — 28 septiembre 2026

65 pruebas aisladas aprobadas. TypeScript API/web y ESLint aprobados. Playwright recurrence: corrida final de 2 pruebas aprobadas, seleccionando 09:15 desde sugerencias y reservando/cancelando la serie. Verificación de ancho y captura móvil. Integración comprueba turno, día cerrado, bloqueo, preparación, exclusión al mover, recursos ajenos y entrada inválida.

## Horarios de consultorios — 28 septiembre 2026

Migración 0013 aplicada. TypeScript API/web, ESLint y build aprobados. Suite aislada: 66 pruebas aprobadas. Validación de apertura/cierre, preparación, sugerencias, series, versiones, protección de reservas futuras y RLS. Playwright room-schedule: 2 pruebas aprobadas en escritorio/móvil, guardado y reapertura del horario; ancho y captura móvil revisados.

## Bloqueos en calendario — 28 septiembre 2026

TypeScript API/web, ESLint y build aprobados. Suite aislada: 66 pruebas, incluyendo devolución de bloqueos, aislamiento, periodo y desaparición tras liberar. Playwright availability: 2 aprobadas; crear, ver evento, consultar detalle y liberar con refresco en escritorio/móvil. Captura móvil revisada.

## Revisión integral de recepción — 29 septiembre 2026

67 pruebas de integración aisladas aprobadas, incluida la nueva prueba con rol Recepción: paciente por llamada, búsqueda, sugerencias, reserva, próxima cita, reprogramación, ciclo confirmado/llegada/consulta/completado e historial, con administración de catálogo y horario denegada. ESLint y build aprobados. Playwright appointments, patient-next y relatives: 8 pruebas aprobadas en escritorio/móvil. Recursos propios para los recorridos de reserva evitan restricciones de datos de pruebas previas. Matriz PHASE2-REVIEW.md consolidada; no se declara fase 2 completa ni validación productiva.

## Navegación de agenda — 29 septiembre 2026

TypeScript web aprobado. Pruebas de navegador: agenda-navigation pasó en escritorio/móvil tras corregir la etiqueta accesible; patient-next pasó en ambos tamaños con la persistencia integrada. Se verificaron recarga, salida y regreso desde Pacientes, vista y fecha, sucursal recordada y recuperación de datos inválidos. Sin cambios en API/base; no se repitió integración backend.

## Base de almacenamiento privado — 29 septiembre 2026

Suite aislada: 70 pruebas aprobadas en 6 archivos (67 anteriores y 3 de almacenamiento). TypeScript API, ESLint y build aprobados. Sin cambios visuales ni endpoints de archivos: no corresponde recorrido E2E nuevo. Pruebas con archivos temporales ficticios; no se activó almacenamiento de producción.

## API de adjuntos — 29 septiembre 2026

Migración 0014 aplicada. Suite aislada: 74 pruebas en 7 archivos. Pruebas nuevas: carga concurrente idempotente, descarga exacta y cabeceras, aislamiento, paciente incorrecto, CSRF, anónimo, rol sin permisos, firma/nombre/base64/tamaño, cuerpo mayor a límite JSON normal, disco/clave ausentes e integridad alterada. TypeScript API y ESLint aprobados. Sin panel nuevo: no se ejecutó E2E visual. Nginx no ejecutado en Docker; configuración de volumen productivo pendiente.

## Panel de archivos — 29 septiembre 2026

TypeScript web, ESLint global y build aprobados. Playwright attachments: 2 aprobadas en escritorio/móvil; formato inválido, error simulado/reintento, persistencia y descarga exacta. Captura móvil revisada y sin desbordamiento. Se configuró almacenamiento local, verificando exclusión de .env y .local/private-files en Git. Backend sin cambios funcionales; última suite aislada: 74 pruebas.

## Fotografías clínicas — 29 septiembre 2026

Migración 0015 aplicada. Suite aislada: 75 pruebas aprobadas, incluyendo permisos clínicos, RLS, historial, reintento concurrente, conflictos e integridad del original. ESLint y TypeScript aprobados; build aprobado antes del ajuste final de flex-wrap. Playwright: 4 pruebas de adjuntos/fotografías escritorio-móvil aprobadas; 2 de fotografías repetidas tras corregir desbordamiento histórico, aprobadas. Captura móvil revisada. Datos de prueba ficticios.


## WebP — 29 septiembre 2026

Migración 0016 aplicada. Suite aislada: 75 pruebas aprobadas, con rechazo de WebP falso. Cuatro pruebas E2E aprobadas: adjuntos administrativos y edición/versionado de un WebP real generado en canvas, en escritorio y móvil. ESLint y build aprobados.

## Estudio de anotaciones — 29 septiembre 2026

Pruebas E2E aprobadas en escritorio y móvil: crear flecha y nota, editar comentario/pieza, arrastrar, ajustar extremo, duplicar, eliminar, deshacer/rehacer, guardar comentario directamente, recargar, zoom, vista original e historial de solo lectura. Prueba móvil incluye arrastre táctil mediante eventos de Chromium. Tiradores con zona táctil de 44 px. Capturas de ambas vistas revisadas; sin desbordamiento. ESLint y build aprobados. Backend sin modificaciones en este bloque; última suite aislada: 75 pruebas.

## Comentarios sobre la imagen — 29 septiembre 2026

75 pruebas de servidor aprobadas. Dos E2E escritorio/móvil aprobadas: vista previa mientras se escribe, desplazamiento de tarjeta sin mover flecha, posición guardada tras recargar y regresión de historial. ESLint y build aprobados. Tarjetas móviles limitadas a la anotación seleccionada; capturas revisadas.


## Separación de notas y guardado — 29 septiembre 2026

Cuatro E2E aprobadas (adjuntos y estudio, escritorio/móvil). Escenarios: POST fallido con borrador recuperable y reintento, POST confirmado seguido de GET fallido con aviso específico, persistencia tras recargar, nota independiente, círculo con comentario removible sin borrar figura y regresión de flechas/versiones. ESLint y build aprobados; capturas revisadas. No se reprodujo una espera infinita real: se añadieron plazos de 15 s y estados explícitos. Backend sin cambios; última suite aislada: 75 pruebas.

## Nombres y cursor — 29 septiembre 2026

75 pruebas aprobadas, incluyendo renombrado, conservación del nombre original, rechazo de vacío, aislamiento y permisos clínicos. Cuatro E2E escritorio/móvil aprobadas: título renombrado persistente tras recarga y cursor normal en Guardar cambios sin pendientes. ESLint, TypeScript y build aprobados. Migración 0017 aplicada.

## Gestos móviles — 29 septiembre 2026

E2E escritorio/móvil aprobadas. Prueba multitáctil con Chromium: pellizco con herramienta Flecha activa, zoom superior a 150%, arrastre de fondo con un dedo, coordenadas y cantidad de figuras intactas y regreso a Ajustar. Regresión de edición, renombrado y guardado aprobada. Captura móvil revisada, sin indicador N y con notas compactas. ESLint, TypeScript y build aprobados. No se ha probado en un dispositivo físico iOS/Android.

## Deselección de tarjetas — 30 septiembre 2026

Corregido el toque sobre el fondo: distingue toque de arrastre, quita selección y compacta las tarjetas en móvil. Conserva comentarios en edición en el borrador; no guarda automáticamente en servidor. E2E escritorio/móvil aprobadas, incluyendo toque táctil fuera de las tarjetas y verificación de textos compactos. TypeScript y ESLint aprobados.


## Foto de perfil — 30 septiembre 2026

Migración 0018 aplicada. 75 pruebas de integración aprobadas; nuevos escenarios de asignación, retiro, rechazo de imagen clínica, aislamiento y conflicto de versión. E2E escritorio y móvil: carga, recarga, reemplazo y retiro aprobados. La repetición móvil alcanzó el límite de cargas; se restableció únicamente el contador de la cuenta demo local y pasó. Captura móvil revisada. TypeScript, ESLint y build aprobados.

## Expediente clínico inicial — 30 septiembre 2026

Migración 0019 aplicada. 76 pruebas aprobadas; validación de alergias, versiones inmutables, reintento concurrente, conflicto, notas sin duplicado, RLS y rechazo de rol administrativo. E2E escritorio/móvil: guardar antecedentes, registrar nota, recargar y consultar versión anterior. Captura móvil revisada. TypeScript API/web, ESLint y build aprobados.

## Odontograma inicial — 30 septiembre 2026

Migración 0020 aplicada. 77 pruebas aprobadas: dentición temporal/permanente, números inválidos y duplicados, reintento concurrente, conflicto, historial, RLS y acceso administrativo denegado. E2E escritorio/móvil aprobadas: cambio de dentición conserva borrador, persistencia, retirada y lectura histórica. Captura móvil revisada. TypeScript API/web, ESLint y build aprobados.

## Superficies y fotografías — 30 septiembre 2026

78 pruebas aprobadas: superficies distintas en una pieza, rechazo de duplicado whole/implícito y fotografía inexistente. E2E escritorio/móvil aprobadas con cambio de superficie, conservación de borrador y vínculo a fotografía persistente tras recarga. TypeScript, ESLint y build aprobados. Sin migración adicional; campos opcionales en JSON existente.

## Selector gráfico — 30 septiembre 2026

E2E escritorio/móvil aprobadas usando zonas gráficas para cambiar superficies y guardar, con fotografía vinculada y lectura histórica. Activación con Enter y sincronización con selector textual verificadas. Captura móvil revisada. TypeScript, ESLint y build aprobados. Backend sin cambios; última suite aislada: 78 pruebas.

## Visor desde odontograma — 30 septiembre 2026

78 pruebas de servidor aprobadas, incluyendo metadatos clínicos con denegación de rol administrativo y aislamiento. E2E escritorio/móvil aprobadas: abrir referencia, imagen visible, ausencia de guardado de anotaciones y conservación del borrador al cerrar. TypeScript API/web, ESLint y build aprobados.

## Plan de tratamiento — 30 septiembre 2026

Migración 0021 aplicada. 79 pruebas aprobadas, incluyendo conflictos, reintentos concurrentes, IDs duplicados, pieza inválida, aislamiento, permisos y versión histórica. E2E escritorio/móvil aprobadas: crear, guardar, recargar, editar estado y consultar versión anterior. Captura móvil revisada. TypeScript API/web, ESLint y build aprobados.

## Servicios en el plan — 30 septiembre 2026

80 pruebas aprobadas: vínculo válido, pieza requerida, servicio inexistente, nombre histórico protegido y conservación tras renombrar/desactivar. E2E escritorio/móvil aprobadas: buscar al escribir, seleccionar, guardar, recargar y consultar historial junto a procedimientos manuales. Captura móvil revisada. TypeScript API/web, ESLint y build aprobados. API local lista y sin migración adicional.

## Presupuestos iniciales — 30 septiembre 2026

Migración 0022 aplicada. 81 pruebas aprobadas, incluyendo importes enteros, descuento excesivo, origen ajeno, moneda, duplicados concurrentes, conflictos, historial, RLS y denegación de acceso. E2E escritorio/móvil aprobadas: preparar desde plan, precio manual, total exacto, guardar, recargar, editar y consultar versión anterior. Captura móvil revisada. TypeScript API/web, ESLint y build aprobados. No hay pagos ni envíos externos en este bloque.

## Expediente ampliado — 30 septiembre 2026

Migración 0023 aplicada. 83 pruebas aprobadas: validación de condiciones, diagnóstico sin observación, conservación de versiones, reintentos concurrentes, cita de otro paciente rechazada y copia histórica conservada tras reprogramar. Cuatro E2E aprobadas en escritorio/móvil: condiciones, nota por cita, diagnóstico general y por superficie con fotografía y lectura histórica. Captura móvil revisada. TypeScript API/web, ESLint y build aprobados.

## Relación profesional — 30 septiembre 2026

Migración 0024 aplicada. 85 pruebas aprobadas, incluyendo externo sin sucursal, validación interno/sucursal, filtros, versiones e impedimento de retirar sucursales con citas pendientes. E2E escritorio/móvil aprobadas con alta y filtro externo, datos profesionales, servicios y consultorios existentes. Captura móvil revisada. TypeScript API/web, ESLint y build aprobados.

## Borradores de recetas — 30 septiembre 2026

Migración 0025 aplicada. 86 pruebas aprobadas: datos históricos, profesional válido, idempotencia concurrente, conflicto de versión, acceso clínico y RLS. E2E escritorio/móvil aprobadas con selección de doctor, guardado, recarga, edición y segundo medicamento. Prueba móvil repetida tras restablecer únicamente el contador local de login de la cuenta demo. Captura móvil revisada. TypeScript API/web, ESLint y build aprobados. Sin emisión de recetas.

## Preparación imprimible de recetas — 30 septiembre 2026

88 pruebas aprobadas: campos incompletos, versión antigua, confirmación requerida, preparación concurrente, bloqueo posterior de edición, permisos/RLS y escape HTML. E2E escritorio/móvil aprobadas: corregir faltantes, preparar, recargar, abrir el documento fijo y solicitar impresión del marco (print sustituido por espía, no se acciona impresora real). Vista escritorio revisada. TypeScript API/web, ESLint y build aprobados. Migración 0026 aplicada. Exportación PDF depende del diálogo del navegador; no se probó una impresora física ni se generó firma.

## Consentimientos iniciales — 30 septiembre 2026

Migración 0027 aplicada. 89 pruebas aprobadas: revisión requerida para habilitar plantilla, versiones, referencias inválidas, idempotencia concurrente, retirada, texto histórico, permisos y RLS. E2E escritorio/móvil aprobadas: crear/habilitar plantilla, preparar por paciente con procedimiento/doctor, recargar, retirar plantilla y consultar historial. Captura móvil revisada. TypeScript API/web, ESLint y build aprobados. Sin firma ni evidencia de aceptación en este bloque.
## Decisiones de consentimientos — 30 septiembre 2026

Migración 0028 aplicada. 92 pruebas aprobadas: aceptación sin evidencia rechazada, tipo/fecha/tamaño inválidos, archivo de 1 MiB admitido, reintentos concurrentes sin duplicados, conflicto de versión/contenido, rechazo, anulación terminal, evidencia conservada, aislamiento entre clínicas/pacientes, permisos clínicos, RLS y escape de HTML.

E2E escritorio/móvil aprobadas: preparar documento, abrir vista previa, solicitar impresión, adjuntar evidencia ficticia, registrar aceptación, recargar, descargar y anular conservando historial. Impresión sustituida por espía; no se probó impresora física ni PDF resultante. Captura móvil revisada y ajustado el ancho del formulario/ayuda de impresión. TypeScript API/web, ESLint y build aprobados. API y web locales respondieron HTTP 200. No se verifica autenticidad de la firma ni se envían archivos fuera del sistema.
## Aceptación e impresión de presupuestos — 30 septiembre 2026

Migración 0029 aplicada. 94 pruebas aprobadas: aceptación de última versión, confirmación requerida, reintentos concurrentes y posteriores, conflictos de contenido/versión, copia histórica, nueva propuesta sin sustitución automática, aceptación posterior, permisos, aislamiento entre clínicas/pacientes y RLS. Documento probado para escape de HTML, importes con centavos y estados propuesta/aceptado/sustituido.

E2E escritorio/móvil aprobadas: consulta histórica sin aceptación habilitada, revisión de total, registro, recarga, nueva propuesta, sustitución expresa e impresión del acuerdo anterior con el importe original. Se sustituye print por espía; no se prueba impresora física ni PDF generado. Captura móvil revisada. Total a acordar también visible junto al formulario. TypeScript API/web, ESLint y build aprobados. API/web respondieron HTTP 200. No se registraron pagos ni firmas electrónicas.
## Pagos, saldo y correcciones — 30 septiembre 2026

Migración 0030 aplicada. 96 pruebas aprobadas: importes inválidos, referencias de acuerdo/sucursal, reintentos concurrentes, liquidación exacta, dos cobros concurrentes por el saldo (uno rechazado), bloqueo de sustitución con pagos vigentes, anulación idempotente, saldo recalculado e historial, aislamiento, CSRF y RLS. Caja puede consultar/capturar sin acceso clínico ni anulación; Contabilidad solo consulta.

E2E escritorio/móvil aprobadas: anticipo 100.25, abono 200.25, liquidación 700.00 sobre acuerdo 1000.50; anular captura ficticia de 100.25 reabre ese saldo y conserva motivo después de recargar. Se corrigieron nombres accesibles de selectores durante la prueba. Capturas de formulario e historial móvil revisadas; sin desbordamiento horizontal. TypeScript API/web, ESLint y build aprobados. API/web respondieron HTTP 200. Operaciones sobre pacientes ficticios; no se ejecutan transacciones bancarias.
## Recibos de pago — 30 septiembre 2026

Migración 0031 aplicada. 98 pruebas aprobadas: recibos protegidos, aislamiento entre pacientes/clínicas, permisos, exclusión de notas/hashes, saldo histórico conservado después de otro pago y estado de anulación actualizado. HTML probado para escape, importes, anulación y presentación de registros anteriores sin saldo histórico.

E2E escritorio/móvil aprobadas con pago, apertura de recibo, consulta previa a impresión, solicitud de impresión (print sustituido por espía), anulación y copia marcada como anulada sin saldo. Captura móvil revisada. TypeScript API/web, ESLint y build aprobados. No se probó impresora física ni PDF resultante; no hay envío externo ni comprobación bancaria.
## Corte de registros de caja — 30 septiembre 2026

Migración 0032 aplicada. 100 pruebas aprobadas: totales de pagos/anulaciones, reintentos concurrentes, copia conservada después de otro pago, vista previa obsoleta rechazada, filtros/referencias inválidos, aislamiento/RLS, frontera de medianoche local y anulación en día posterior (neto negativo), permisos Caja/Contabilidad. E2E escritorio/móvil aprobadas: consultar, revisar, guardar y recargar corte conservado. Captura móvil revisada, sin desbordamiento horizontal. TypeScript API/web, ESLint y build aprobados. Corte de registros, sin arqueo físico ni bloqueo de periodo.
## Arqueo de efectivo — 30 septiembre 2026

Migración 0033 aplicada. 102 pruebas aprobadas: cálculo separado por moneda y método, anulaciones sin descuento automático, ajustes, faltante/sobrante, razón obligatoria, monedas omitidas/duplicadas, importes inválidos, esperado negativo, historial inmutable, concurrencia/idempotencia, aislamiento/RLS y Contabilidad de solo lectura. Primera ejecución durante interrupción tuvo timeout en recuperación de contraseña; repetición completa pasó sin cambiar esa prueba ni sus tiempos.

E2E escritorio/móvil aprobadas: guardar corte, capturar fondo/efectivo/ajuste, guardar arqueo sin diferencia, corregir con faltante/motivo y recargar ambas versiones. Ajustados selectores de pruebas para distinguir estados de corte/arqueo. Capturas móviles de formulario e historial revisadas; sin desbordamiento horizontal. TypeScript API/web, ESLint y build aprobados. El efectivo es declarado por el usuario; no hay transacciones bancarias, egresos reales ni bloqueo de periodos.
## Navegación de módulos — 30 septiembre 2026

Prueba E2E aprobada en escritorio y móvil: accesos desde menú, búsqueda progresiva, apertura/enfoque de historia clínica, presupuestos y pagos, navegación a cortes/reportes, etiquetas Pendiente y restricción visual con permisos simulados en respuesta de organización. Simulación solo para control de interfaz; APIs y permisos del servidor sin cambios. Corregido el test móvil para abrir el menú antes de pulsar sus opciones. Captura móvil revisada. TypeScript web, ESLint y build aprobados. No se repitió suite de API sin cambios; último resultado completo 102 pruebas.

## 01/10/2026 — Impresión de corte y arqueo

- Typecheck web, lint de archivos modificados y compilación de producción correctos.
- Dos pruebas unitarias del documento: escape de texto, movimientos fuera de primera página, monedas separadas, neto negativo, ajustes/diferencias y estados de versión/sin arqueo.
- E2E de caja en escritorio y móvil: guardado/corrección/recarga, vista previa, selección de arqueo anterior/último/omitido, llamada de impresión interceptada y cierre del documento. Ambos pasan; captura móvil revisada sin desbordamiento.
- No se verificó impresora física ni archivo PDF generado por el diálogo del sistema. No hubo cambios de API/esquema; no se repitió la suite completa de integración.

## 01/10/2026 — Participación profesional

- Suite en base temporal aislada: 107 pruebas correctas (14 archivos). Nuevos casos: redondeo exacto, reintentos concurrentes, versión obsoleta, historial, cambio de nombre, aislamiento/RLS, inmutabilidad, acuerdo sustituido, profesional inactivo y permisos de Contabilidad/Caja.
- E2E escritorio/móvil: acuerdo con descuento, búsqueda de doctor, cálculo 33.33%, asignación, corrección a 50%, recarga e historial. Ambos correctos; captura móvil revisada sin desbordamiento.
- Lint completo, typecheck API/web y build correctos. Migración 0034 aplicada al entorno local.
- Este bloque no implementa pagos al profesional; no se verificaron transferencias o egresos reales.

## 01/10/2026 — Pagos al profesional

- Suite aislada completa: 108 pruebas correctas, 14 archivos. Casos añadidos: pagos concurrentes sin sobrepasar saldo, liquidación exacta, reintentos, rechazo de asignación/sucursal inválida, bloqueo de acuerdo/asignación, anulación idempotente, aislamiento y prohibición de borrado, consulta Contabilidad y escritura restringida.
- E2E escritorio/móvil: abono, liquidación, anulación de captura, saldo tras recarga y bloqueo visual de corrección. Ambos correctos; captura móvil revisada.
- Typecheck API/web, lint y compilación correctos. Migración 0035 aplicada localmente.
- No hubo transferencias reales; pagos ficticios de prueba. Egresos aún no integrados automáticamente al corte/arqueo.

## 01/10/2026 — Egresos profesionales en caja

- Suite aislada: 111 pruebas correctas (14 archivos). Cubre cálculo con egresos, referencias de anulación sin reintegro, transferencias excluidas del efectivo, fecha local cruzando medianoche, responsable con solo egresos, confirmación obligatoria y snapshots/cálculos históricos intactos.
- E2E corte/arqueo en escritorio y móvil correctos. E2E participación/pagos/egresos en escritorio y móvil correctos tras corregir un selector exacto del texto de diferencia en la prueba; revisión obligatoria, arqueo guardado e impresión con egresos verificados. Captura móvil revisada.
- Typecheck API/web, lint y build correctos. Sin migraciones de tablas. No se probó impresora física.
- La revisión de ajustes es explícita, no detección automática de duplicados por texto libre.

## 01/10/2026 — Recibos profesionales

- 113 pruebas correctas en base aislada (15 archivos): contexto guardado/legacy, permisos, alcance paciente/organización, anulación y escape de texto.
- E2E escritorio/móvil: recibo vigente, anulación por API con vista abierta, reconsulta antes de impresión interceptada, marca ANULADO, retiro de saldo y cierre. Captura móvil revisada.
- Lint completo, typecheck API/web y build correctos. Migración 0036 aplicada localmente.
- No se probó impresora física ni archivo PDF exportado por el diálogo del sistema.

## 01/10/2026 — Reporte profesional

- Suite aislada: 115 pruebas correctas (15 archivos). Periodos con pagos/anulaciones en días distintos, saldo actual independiente de fechas, periodos vacíos, fechas inválidas, aislamiento, permisos Caja/Contabilidad, inactivos y exclusión de doctor sustituido verificados.
- E2E escritorio/móvil correctos tras corregir distribución adaptable: navegación desde Reportes, búsqueda, consulta, recibo y periodo vacío. Comprobación automática sin desbordamiento horizontal.
- Typecheck API/web, lint completo y compilación correctos. Sin migración. Impresión/exportación del reporte pendiente.

## 01/10/2026 — Impresión del reporte profesional

- Dos pruebas unitarias nuevas correctas: 25 movimientos completos, importes/monedas, neto negativo, estados vacíos y escape de texto/omisión de identificadores de pacientes.
- E2E escritorio/móvil correctos: vista previa, llamada de impresión interceptada, cierre y retiro del documento al cambiar fechas. Captura móvil revisada.
- Typecheck web, lint completo y build correctos. Sin cambios de API/esquema; no se repitió integración completa (última: 115 pruebas).
- No se probó impresora física ni PDF exportado desde el diálogo del sistema.

## 01/10/2026 — Preferencias de recordatorios

- Suite aislada: 120 pruebas correctas (17 archivos). Incluye 24 horas por ambos canales, reprogramación/cancelación, contactos cambiados, inactivos, permisos, aislamiento y escritura concurrente 201/409.
- E2E escritorio/móvil correctos: guardar ambos canales, recargar, consultar vista previa, desactivar y conservar historial; sin desbordamiento horizontal. Captura móvil revisada.
- Typecheck API/web, lint completo y build correctos. Migración 0037 aplicada localmente.
- No se enviaron mensajes ni se verificaron proveedores externos. La vista previa no es una cola de envíos.

## 01/10/2026 — Cola persistente de recordatorios

- Suite aislada: 121 pruebas correctas (17 archivos), tras separar recursos del nuevo escenario de los horarios configurados en pruebas anteriores. Verifica reintentos, reprogramación, cambios de preferencias/contactos, concurrencia confirmación/preferencias, cancelación, RLS y prohibición de borrar cola.
- E2E escritorio/móvil: preparación por ambos canales, reprogramación con historial e invalidación al cancelar; sin desbordamiento horizontal. Captura móvil revisada.
- Typecheck API/web, lint completo y build correctos. Migración 0038 aplicada localmente. Sin entregas reales ni proveedores probados.
- PostgreSQL local recuperado y puerto cambiado de 55432 (EACCES de Windows al escuchar) a 25432 en .env local. Web/API locales iniciadas; datos conservados.

## 01/10/2026 — WhatsApp manual

- Suite aislada: 125 pruebas correctas (18 archivos). URL y caracteres especiales, zona horaria, alcance paciente/organización, permisos, autorización, contactos cambiados, borrador desactualizado, cancelación y citas de menos de 24 horas sin cola.
- E2E escritorio/móvil correctos: preparar, editar, apertura interceptada con URL/texto comprobados, bloqueo tras reprogramar y conservación del texto. Captura móvil revisada, sin desbordamiento horizontal.
- Typecheck API/web, lint y build correctos; sin migración. Se corrigieron expectativas de formato horario/selector en pruebas y se añadió nombre accesible explícito al campo del mensaje.
- No se contactó a pacientes ni se abrió una cuenta real de WhatsApp: navegación interceptada en pruebas. No hay verificación de envío, recepción o lectura.

## 01/10/2026 — Remisiones, finanzas, inventario y laboratorios

- Suite aislada: 130 pruebas correctas en 19 archivos. Incluye transiciones clínicas, informes obligatorios, control de versiones, permisos/RLS, stock por sucursal y concurrencia, traslado de pagos, devoluciones concurrentes, saldo a favor y efecto en corte/arqueo.
- E2E: 2 escenarios nuevos correctos (escritorio/móvil), más 4 de regresión de caja y participación profesional. Capturas móviles revisadas; se corrigió texto cortado en selector de pagos y se repitieron ambos escenarios.
- Typecheck API/web/database y lint correctos. Build correcto; ajuste posterior de estilo del selector validado con typecheck, lint y E2E.
- Migraciones 0039–0042 aplicadas localmente. No hubo envío a especialistas/pacientes, movimientos bancarios ni publicación en Git. Límites operativos documentados en OPERATIONS-EXPANSION.md.
