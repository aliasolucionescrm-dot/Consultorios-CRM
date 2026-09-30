# ALIA DENTAL

Sistema de gestión odontológica de **Alia Soluciones**. Incluye fase 1, pacientes, catálogos y agenda con vistas diaria/semanal/mensual, filtros, reservas, estados, horarios y bloqueos. Información clínica permanece pendiente. Consulta [calendario](docs/CALENDAR.md), [catálogos](docs/CATALOGS.md), [agenda](docs/APPOINTMENTS.md) y [disponibilidad](docs/AVAILABILITY.md).

## Ejecutar localmente

Requisitos: Node.js 24, npm y PostgreSQL 17. Copiar `.env.example` a `.env`. Configurar MIGRATION_DATABASE_URL con el administrador, generar APP_DB_PASSWORD (32 bytes hexadecimales) y usar esa contraseña en DATABASE_URL con usuario `alia_runtime`. Generar MFA_ENCRYPTION_KEY de 32 bytes hexadecimales. Nunca versionar `.env`.

```sh
npm ci
npm run db:local
# En otra terminal, desde la raíz:
npm run db:migrate
npm run db:provision
npm run db:seed
npm run db:seed-patients
node scripts/local-mail.mjs
# En otra terminal:
npm run dev
```

`db:local` ejecuta PostgreSQL real, limitado a loopback, y conserva datos en `.local/postgres`. Es una alternativa de desarrollo cuando no existe Docker. El seed requiere `ALLOW_DEMO_SEED=true`, `DEMO_PASSWORD` de al menos 12 caracteres y un entorno no productivo.

- Aplicación: http://localhost:3000
- API: http://127.0.0.1:4000
- OpenAPI: http://127.0.0.1:4000/api/docs (solo desarrollo)
- Buzón local: http://127.0.0.1:8025 (mensajes JSON, solo desarrollo)
- Usuarios ficticios: `ana@alia.example` (propietaria), `carlos@alia.example` (odontólogo). Contraseña: valor local `DEMO_PASSWORD`.

En el equipo de esta entrega npm se instaló localmente en `.tools/package`. Si `npm` no está en PATH, usar `node .tools/package/bin/npm-cli.js` en su lugar. Los scripts que invocan npm requieren una instalación convencional o añadir `.tools/package/bin` a PATH.

## Funcionalidad implementada

- Login/logout, caducidad, sesiones/dispositivos revocables, Argon2id, límites persistentes y bloqueo progresivo.
- Recuperación por correo, cambio de contraseña, MFA TOTP con protección contra reutilización y ocho códigos de recuperación de un solo uso.
- Organizaciones independientes, cambio de organización, sucursales, invitaciones, membresías y suspensión de acceso.
- Diez roles iniciales; roles personalizados; autorización en servidor y prevención de escalamiento de privilegios.
- Auditoría transaccional de cambios administrativos, historial paginado y protección contra modificación/borrado.
- Interfaz adaptable, búsqueda de acciones Ctrl/Cmd+K y navegación por teclado.
- Pacientes: registro, edición con control de versiones, búsqueda tolerante, cursor, desactivación y aislamiento RLS. Consulta alcance y límites en [Pacientes](docs/PATIENTS.md).

## Verificaciones

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` crea automáticamente una base temporal local, aplica las migraciones, prueba la API con `alia_runtime` y elimina únicamente esa base al terminar. La suite rechaza ejecución directa sin ese entorno. E2E requiere aplicación, seed y base disponibles.

## Cierre técnico de fase 1

La aplicación ya usa una cuenta DB sin DDL ni superusuario. Correo de invitación y recuperación se guarda cifrado en una cola transaccional, con reintentos y borrado del token al entregar/cancelar. La sección Equipo muestra el estado de entrega.

`npm run db:backup-drill` verifica una restauración local usando pg_dump/pg_restore de PostgreSQL 17, PG_BIN y una clave BACKUP_ENCRYPTION_KEY independiente. Produce respaldo cifrado y evidencia en `.local/backups`; compara todas las tablas contra una instantánea consistente y conserva la base original.

En una instalación vacía sin seed: definir BOOTSTRAP_EMAIL, BOOTSTRAP_NAME y BOOTSTRAP_PASSWORD (16+ caracteres), ejecutar `npm run db:bootstrap` con credenciales de migración, retirar esas variables, iniciar sesión y crear la primera organización. El bootstrap se niega a operar si ya existe un usuario.

Consulta [arquitectura](ARCHITECTURE.md), [base de datos](DATABASE.md), [seguridad](SECURITY.md), [despliegue](DEPLOYMENT.md), [plan](docs/PLAN.md) y [cambios](CHANGELOG.md).
