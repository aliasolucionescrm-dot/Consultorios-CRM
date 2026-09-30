# Base de datos

`0001_foundation.sql` crea accounts, users, organizations, branches, permissions, roles, role_permissions, memberships, sessions, recovery_codes, password_resets, invitations, rate_limits y audit_logs.

`0002_mail_outbox.sql` incorpora correo transaccional con tokens cifrados, estados, expiración e índice parcial de pendientes. `0003_runtime_privileges.sql` crea el grupo `alia_app` y concede solo los permisos necesarios. `npm run db:provision` crea el login `alia_runtime` con un verificador SCRAM generado desde APP_DB_PASSWORD. El servidor no recibe la contraseña en texto dentro del SQL. Las migraciones futuras deben conceder explícitamente sus nuevos permisos.

- UUID como clave primaria; timestamps `timestamptz` en UTC.
- `branches`, `roles`, `role_permissions`, `memberships`, `invitations` tienen organization_id.
- FK `(organization_id,role_id)` impide asociar membresías/invitaciones a roles de otra organización.
- Índices por usuario de membresía, sesión, expiración y auditoría `(organization_id,created_at DESC,id DESC)`.
- Auditoría append-only mediante trigger que bloquea UPDATE, DELETE y TRUNCATE. El propietario/superusuario de DB aún puede alterar esquema: requiere controles operacionales separados.
- Historial usa cursor timestamp+UUID. Validación estricta de cursor en API.
- Sin soft delete genérico: miembros/sucursales se desactivan; sesiones se revocan. Los registros históricos se conservan.
- El migrador usa advisory lock, transacciones y checksum; se niega a aceptar migraciones previamente aplicadas cuyo contenido cambió.

## Migrar

`npm run db:migrate`. `MIGRATION_DATABASE_URL` permite usar credenciales distintas. No usar db push ni editar una migración aplicada. Crear un archivo SQL numerado nuevo.

## Siguientes fases

`0005_operational_catalogs.sql` crea professionals, professional_branches, rooms, services y service_price_history; RLS, FK compuestas, permisos e historial monetario inmutable. No crea reservas ni horarios.

`0004_patients.sql` ya incorpora pacientes, índices, pg_trgm, normalización y RLS forzada. El rol de aplicación tiene SELECT/INSERT/UPDATE, sin DELETE. Folios transaccionales, request_id para reintentos y version para concurrencia.

Agenda necesitará restricciones de exclusión para evitar reservas concurrentes. Dinero usará cantidades decimales o unidades menores enteras, idempotencia y asientos trazables. Esas tablas e índices se crearán mediante migraciones en sus fases.
