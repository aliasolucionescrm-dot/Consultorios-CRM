# Arquitectura

## Estado inspeccionado

El repositorio estaba vacío. No existían aplicaciones, dependencias, migraciones ni código reutilizable. Se creó un monorepo npm con un monolito modular NestJS y frontend Next.js App Router.

## Estructura

```
apps/web/app             Página y estilos globales
apps/web/components      Flujos administrativos y autenticación
apps/web/lib             Cliente HTTP y contratos
apps/api/src             Auth, autorización, organizaciones, correo, health
packages/database/src   Pool, Drizzle, roles, migrador y seed
packages/database/migrations  SQL versionado
infra/docker            Imagen de aplicación
infra/nginx             Reverse proxy
scripts                 Entorno de desarrollo
tests                   Integración PostgreSQL y E2E
```

Los dominios clínico, agenda, tratamientos, caja, inventario y laboratorios se añadirán en sus fases. No hay microservicios ni tablas vacías para fingir módulos terminados. User significa acceso, no empleado ni profesional; esas entidades se incorporarán por separado.

## Decisiones

- PostgreSQL 17 y UUID v4 generado por servidor: estable y disponible en PostgreSQL, sin depender de reloj del cliente.
- Drizzle para consultas tipadas de autenticación; SQL parametrizado para operaciones transaccionales y controles específicos. Las migraciones SQL son la fuente de verdad.
- Sesión opaca en cookie HttpOnly, hash SHA-256 en servidor, SameSite Strict y token CSRF. No se guardan credenciales en localStorage.
- Cuenta agrupa organizaciones; membresía da acceso a una organización. Crear otra organización crea por ahora una cuenta independiente. Facturación SaaS y agrupación comercial de cuentas se diseñarán posteriormente.
- Roles y permisos propios del tenant, con claves foráneas compuestas. Autorización revisada en cada solicitud: revocar membresía tiene efecto inmediato.
- Redis queda como perfil opcional `queues`; no se usa como cache sin necesidad. Límites de acceso persistentes funcionan con PostgreSQL y no dependen de una sola instancia.
- S3 se introduce junto a archivos clínicos en fase 3. La fase 1 no recibe archivos.
- Buzón SMTP local para probar correo. No se inventa un proveedor ni se envían correos reales durante pruebas.
- Next.js 16 requiere lint explícito. Documentación consultada: https://nextjs.org/docs/app/getting-started/installation y https://docs.nestjs.com/security/authentication.

## Límites actuales

El selector de sucursal conserva contexto visual dentro de la organización. No es una frontera de autorización clínica todavía. Equipo se limita a 200 miembros y las invitaciones recientes a 100; se incorporará paginación antes de atender organizaciones que excedan esos límites. No hay búsqueda de pacientes en fase 1.

## Diseño

Fondo `#F8FBFC`, texto `#173042`, aqua `#18B6A4`, azul `#2D7FF9`. Para botones/texto sobre blanco se usa aqua oscuro `#087F73`, que mejora contraste. Fuente del sistema sin descarga externa; iconos Lucide. Radix Dialog aporta foco atrapado y cierre accesible al command palette. React Hook Form + Zod validan el acceso; Zod valida todos los cuerpos de API. Tailwind 4 y CSS con variables definen una identidad propia, sin tarjetas repetitivas. No se añadió shadcn como otra dependencia porque las primitivas existentes resuelven los controles de esta fase.
