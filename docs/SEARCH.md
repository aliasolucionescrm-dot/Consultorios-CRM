# Búsqueda global operativa

El buscador superior y Ctrl/Cmd+K conservan acciones y pacientes, y agregan profesionales, consultorios, servicios y citas. Los resultados aparecen al escribir, con 250 ms de espera y descarte de respuestas obsoletas.

`GET /api/search?q=texto` requiere sesión, organización activa y `organizations.view`. Entre 2 y 100 caracteres. Cada grupo devuelve hasta cinco resultados y `hasMore`; se indica que debe acotarse el texto cuando hay más. No registra el texto buscado: auditoría conserva solo el número de resultados.

- Catálogos: solo con `catalogs.view`. Nombre parcial sin distinción de acentos o mayúsculas; servicios también por código. Activos primero, incluye inactivos. Devuelve exclusivamente ID, nombre y estado, sin costos ni contacto.
- Citas: solo con `appointments.view`. Busca por nombre de paciente, expediente, servicio, profesional o consultorio. Prioriza citas futuras cercanas y después pasadas cercanas. Incluye todos los estados y muestra fecha local, sucursal, servicio y estado. Abre el día y la sucursal correspondientes, no el detalle individual automáticamente.
- Pacientes: conserva endpoint y permisos `patients.view`, búsqueda tolerante por datos administrativos y acceso a ficha ya existentes.
- Aislamiento mediante filtro de organización y RLS. El rol sin permisos operativos recibe grupos vacíos. Caracteres SQL y comodines se tratan como datos.

Seleccionar un catálogo abre el registro por ID, incluyendo inactivos y evitando confundir homónimos. «Ver todo el catálogo» retira esa selección. Navegar normalmente reinicia el destino temporal; no es un enlace persistente al recargar.

Limitaciones: coincidencia por fragmento en entidades operativas, sin corrección de errores ni búsqueda por teléfono de citas; sin paginación global o exportación. No hay benchmark de gran volumen, índices específicos nuevos ni búsqueda externa. La búsqueda abarca toda la organización, no solo la sucursal seleccionada. El detalle de citas usa la paginación habitual del día. No incluye documentos clínicos, finanzas ni inventario.

Verificación: 57 pruebas de integración aprobadas, incluyendo permisos, tenants, acentos, comodines y ausencia de costos. Dos E2E aprobadas en escritorio/móvil, apertura de servicio por ID y navegación a citas. Tipos, lint y build correctos; captura móvil inspeccionada.
