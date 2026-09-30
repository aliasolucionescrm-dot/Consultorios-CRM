# Catálogos operativos — fase 2, bloque 2

Profesionales: nombre, especialidad, cédulas, contacto, sucursales y estado. No crea usuario ni empleado, ni verifica externamente la cédula. Consultorios: sucursal, nombre, número, sillón, equipamiento y notas. Servicios: código, categoría, especialidad, duración, precio, costo, moneda y requisitos de pieza/consentimiento.

Los tres admiten alta, edición con control de versión, desactivación con motivo, búsqueda por nombre, paginación de 25 registros, permisos y auditoría.

## API y datos

GET/POST `/api/catalogs/:kind`; PATCH `/api/catalogs/:kind/:id`. kind admite professionals, rooms o services. GET recibe q, status y page. GET `/api/catalogs/services/:id/prices` consulta los últimos 100 cambios de precio.

`catalogs.view`: propietario, administrador, odontólogo, especialista, asistente, recepción y caja. `catalogs.manage`: propietario y administrador. Las organizaciones existentes reciben los permisos por migración; las nuevas por definición de roles. Roles personalizados pueden recibirlos.

Cinco tablas nuevas con RLS forzada, SET LOCAL y filtro tenant adicional. FK compuestas impiden sucursales ajenas. Registros activos requieren sucursales activas al guardar. Cambiar estado exige motivo; versión obsoleta devuelve 409. No se concede borrado de entidades principales.

Importes enteros en centavos, moneda validada contra organización, duración entre 5 y 480 minutos. Historial inmutable con precio/costo/moneda, versión y usuario. Lectores de catálogo pueden ver costos actuales; solo administradores ven historial y editan. Separar permiso de costos actuales si la política de la clínica lo exige.

Alta sin idempotency key: verificar el directorio antes de repetir tras una respuesta perdida. Códigos de servicio, nombres de consultorio por sucursal y cédulas no vacías por organización son únicos. Listados LIMIT/OFFSET para catálogos, no historiales masivos; sin prueba de carga a gran escala.

## Pendientes expresos

Agenda incorporará horarios, vacaciones, disponibilidad y reservas con conflictos. No se implementan todavía servicios por profesional, comisiones, documentos, firmas, fotografías, materiales, impuestos ni laboratorios. Los catálogos no crean tratamientos ni cobros. Formularios sin recuperación de borradores tras navegación.

## Verificación

`npm run db:seed-catalogs`, con API local activa y demo habilitada, añade dos profesionales, dos consultorios y tres servicios ficticios sin reemplazar registros existentes. No asigna cédulas inventadas.

42 pruebas de integración aprobadas: permisos, RLS, referencias entre organizaciones, validación monetaria, versiones, auditoría e historial. Dos E2E específicos de catálogos pasan en escritorio y móvil. Docker, TLS y SMTP productivos siguen pendientes de validación en destino.
