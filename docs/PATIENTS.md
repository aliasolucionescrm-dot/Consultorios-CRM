# Pacientes — fase 2, bloque 1

Directorio y ficha administrativa: alta, edición, búsqueda, contacto, WhatsApp, nacimiento, sexo, domicilio, ocupación, tutor, contacto de emergencia, datos fiscales, etiquetas y notas administrativas. Desactivación con motivo auditado; sin borrado de referencias.

No incluye todavía archivos, fotografías, familiares relacionados, citas, tratamientos, saldos ni expediente clínico. Las notas administrativas no sustituyen antecedentes ni alertas médicas.

## Flujo y API

Pacientes → Nuevo paciente → nombre y apellidos → Registrar → ficha → Editar datos. Cada ficha tiene URL `/#patients/<uuid>`; recargar conserva la selección, sin conceder permisos adicionales. Ctrl/Cmd+K busca pacientes activos y presenta hasta cinco resultados con teléfono parcialmente oculto.

| Método | Ruta | Permiso | Parámetros |
|---|---|---|---|
| GET | /api/patients | patients.view | q, status, limit 1–50, cursor |
| GET | /api/patients/:id | patients.view | UUID de paciente |
| POST | /api/patients | patients.create | first_name, last_name, request_id UUID y datos opcionales |
| PATCH | /api/patients/:id | patients.edit | Ficha editable completa, version; reason si cambia active |

PATCH reemplaza los campos editables; no es un merge parcial. Devuelve 409 si otra edición avanzó la versión. El formulario conserva valores ante errores. Volver desde el formulario y recargar advierten de cambios sin guardar; la navegación lateral aún no intercepta todos los cambios de ruta. No se persisten borradores en localStorage.

## Integridad y privacidad

Folio reservado mediante contador y bloqueo transaccional de la organización. No se acepta organization_id ni record_number del cliente. Reintentar request_id con el mismo contenido devuelve el mismo registro; otro contenido produce 409. Teléfono/correo compartidos entre familiares están permitidos.

RLS forzada en patients, además de membresía, permiso y filtro tenant en la API. SET LOCAL se aplica en la misma transacción y no permanece en conexiones del pool. No protege frente a un DBA comprometido ni sustituye autorización. El rol de aplicación carece de DELETE.

Auditoría transaccional de alta, edición y lecturas. Registra campos modificados y versiones, sin copiar nombres, teléfonos, notas ni términos buscados. Los motivos deben evitar información clínica.

## Búsqueda

Normalización de acentos, teléfono sin separadores y pg_trgm para palabras de cuatro o más letras (umbral 0.3). Fragmentos como «mar fer», correo y folio también funcionan. Índices por tenant/nombre, teléfono y email; índice parcial de activos y GIN de texto normalizado.

Cursor ligado a organización, búsqueda y estado, ordenado por apellidos/nombre/UUID. Veinte filas por defecto, cincuenta máximo; no se descargan todos los pacientes. Cambiar apellidos durante la paginación puede cambiar su posición: reiniciar la búsqueda para actualizar el recorrido.

Queda pendiente probar carga representativa y EXPLAIN con grandes volúmenes: RLS puede limitar el uso de ciertos filtros en índices. No se afirma rendimiento validado con cientos de miles de pacientes. Referencia: [pg_trgm PostgreSQL 17](https://www.postgresql.org/docs/17/pgtrgm.html).

## Demostración y pruebas

`npm run db:seed-patients` añade seis pacientes ficticios, idempotentemente, solo a la organización demo y con ALLOW_DEMO_SEED=true fuera de producción. Correos example.invalid; sin teléfonos reales.

Pruebas de integración: tenant, RLS sin WHERE, permisos, fechas, folios simultáneos, reintentos, búsquedas, cursores, versiones y auditoría. E2E: alta, edición, recarga, búsqueda y desactivación en escritorio y móvil.
