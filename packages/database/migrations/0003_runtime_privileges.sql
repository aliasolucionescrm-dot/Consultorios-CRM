-- Cluster-wide privilege group; login credentials are provisioned separately.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='alia_app') THEN
  CREATE ROLE alia_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO alia_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON accounts,users,organizations,branches,roles,
 role_permissions,memberships,sessions,recovery_codes,password_resets,invitations,
 rate_limits,mail_outbox TO alia_app;
GRANT SELECT ON permissions,schema_migrations TO alia_app;
GRANT SELECT,INSERT ON audit_logs TO alia_app;
REVOKE UPDATE,DELETE,TRUNCATE ON audit_logs FROM alia_app;
-- Deliberately no default privileges: each new domain must grant its needs explicitly.
