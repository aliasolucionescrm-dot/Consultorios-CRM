# Servicios por profesional

Cada profesional puede atender todos los servicios activos (valor inicial compatible con los registros existentes) o una selección explícita de hasta 500 servicios. Una selección vacía impide nuevas reservas.

La configuración se abre desde Profesionales → Servicios habilitados y requiere catalogs.manage. Su versión es compartida con el catálogo del profesional. La búsqueda permite añadir servicios sin limitarse a la primera página del catálogo.

Al cambiar el profesional en una reserva se borra el servicio seleccionado. Las opciones se filtran por profesional y sucursal; el servidor vuelve a validar la relación en reservas, reprogramaciones y series. Los servicios inactivos nunca se ofrecen al reservar.

El cambio utiliza el mismo bloqueo transaccional que la agenda. No permite retirar servicios utilizados en citas pendientes, confirmadas, llegadas o en consulta cuya ocupación todavía no termina. Las citas históricas conservan sus datos. La configuración aplica a todas las sucursales del profesional.

Migración 0010: bandera restrict_services y tabla professional_services con claves compuestas, RLS forzado y permisos mínimos. Cambios auditados. No configura comisiones, materiales ni precios específicos por profesional.
