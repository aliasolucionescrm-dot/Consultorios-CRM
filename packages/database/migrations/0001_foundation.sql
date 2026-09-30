CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 2 AND 160), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE CHECK(email = lower(email)), name text NOT NULL,
 password_hash text NOT NULL, active boolean NOT NULL DEFAULT true, failed_attempts integer NOT NULL DEFAULT 0,
 locked_until timestamptz, mfa_secret text, mfa_pending_secret text, mfa_last_step bigint,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES accounts(id), name text NOT NULL,
 legal_name text NOT NULL DEFAULT '', rfc text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
 address text NOT NULL DEFAULT '', timezone text NOT NULL DEFAULT 'America/Mexico_City', currency char(3) NOT NULL DEFAULT 'MXN',
 locale text NOT NULL DEFAULT 'es-MX', record_prefix text NOT NULL DEFAULT 'P', record_sequence bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organizations_account_idx ON organizations(account_id);
CREATE TABLE branches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL,
 address text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,name)
);
CREATE TABLE permissions (code text PRIMARY KEY, description text NOT NULL);
CREATE TABLE roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL,
 system boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), UNIQUE(organization_id,name)
);
CREATE TABLE role_permissions (
 organization_id uuid NOT NULL, role_id uuid NOT NULL, permission_code text NOT NULL REFERENCES permissions(code),
 PRIMARY KEY(role_id,permission_code), FOREIGN KEY(organization_id,role_id) REFERENCES roles(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE memberships (
 organization_id uuid NOT NULL REFERENCES organizations(id), user_id uuid NOT NULL REFERENCES users(id), role_id uuid NOT NULL,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id),
 FOREIGN KEY(organization_id,role_id) REFERENCES roles(organization_id,id)
);
CREATE INDEX memberships_user_idx ON memberships(user_id) WHERE active;
CREATE TABLE sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), token_hash text NOT NULL UNIQUE,
 csrf_token text NOT NULL, user_agent text NOT NULL, ip inet, created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON sessions(user_id,created_at DESC);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at) WHERE revoked_at IS NULL;
CREATE TABLE recovery_codes (
 user_id uuid NOT NULL REFERENCES users(id), code_hash text NOT NULL, used_at timestamptz, PRIMARY KEY(user_id,code_hash)
);
CREATE TABLE password_resets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), email text NOT NULL,
 role_id uuid NOT NULL, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(organization_id,role_id) REFERENCES roles(organization_id,id)
);
CREATE INDEX invitations_org_idx ON invitations(organization_id,created_at DESC);
CREATE TABLE rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX rate_limits_expiry_idx ON rate_limits(expires_at);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES organizations(id), user_id uuid REFERENCES users(id),
 action text NOT NULL, entity text NOT NULL, entity_id text, ip inet, user_agent text NOT NULL DEFAULT '',
 before jsonb, after jsonb, reason text, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_org_created_idx ON audit_logs(organization_id,created_at DESC,id DESC);
CREATE INDEX audit_user_created_idx ON audit_logs(user_id,created_at DESC);
CREATE FUNCTION deny_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_logs is append only'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION deny_audit_mutation();

INSERT INTO permissions(code,description) VALUES
 ('organizations.view','Ver organización'),('settings.manage','Configurar organización y sucursales'),
 ('users.view','Ver equipo y roles'),('users.manage','Invitar y administrar miembros'),('roles.manage','Administrar roles y permisos'),
 ('audit.view','Consultar auditoría'),('patients.view','Ver pacientes'),('patients.create','Crear pacientes'),('patients.edit','Editar pacientes'),
 ('clinical_records.view','Ver expedientes'),('clinical_records.edit','Editar expedientes'),('odontogram.view','Ver odontograma'),
 ('odontogram.edit','Editar odontograma'),('clinical_notes.create','Crear notas'),('clinical_notes.sign','Firmar notas'),
 ('appointments.view','Ver agenda'),('appointments.create','Crear citas'),('appointments.edit','Editar citas'),
 ('payments.view','Ver pagos'),('payments.create','Registrar pagos'),('payments.cancel','Cancelar pagos'),('reports.financial','Ver reportes financieros'),
 ('inventory.view','Ver inventario'),('inventory.edit','Editar inventario'),('employees.manage','Administrar empleados');
