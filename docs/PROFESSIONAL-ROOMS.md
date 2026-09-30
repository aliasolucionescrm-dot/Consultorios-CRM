# Consultorios por profesional

Desde Profesionales → Consultorios habilitados se puede permitir todos los consultorios de sus sucursales (valor inicial) o seleccionar hasta 500. La selección vacía bloquea nuevas reservas. El selector permite buscar por nombre dentro de cada sucursal del profesional y muestra la sucursal junto a cada consultorio asignado.

La configuración requiere catalogs.manage, comparte la versión del profesional y queda auditada. Solo acepta consultorios de las sucursales a las que pertenece el profesional. Los inactivos permanecen visibles en la configuración, pero nunca se ofrecen al reservar.

Al cambiar profesional en el formulario se limpian el consultorio y servicio seleccionados. La API filtra las opciones por sucursal y profesional y valida nuevamente reservas, reprogramaciones y series. La configuración utiliza el bloqueo transaccional de agenda e impide retirar consultorios usados en citas pendientes, confirmadas, llegadas o en consulta cuya ocupación no ha terminado.

Migración 0011: restrict_rooms y professional_rooms con claves compuestas, RLS forzado y permisos mínimos. La asignación no es exclusiva: varios profesionales pueden utilizar un consultorio, sujetos a la prevención existente de solapamientos. No agrega horarios propios del consultorio ni otros recursos reservables.
