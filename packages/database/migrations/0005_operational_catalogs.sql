INSERT INTO permissions(code,description) VALUES
 ('catalogs.view','Consultar profesionales, consultorios y servicios'),
 ('catalogs.manage','Administrar profesionales, consultorios y servicios');
INSERT INTO role_permissions(organization_id,role_id,permission_code)
 SELECT organization_id,id,'catalogs.view' FROM roles WHERE system AND name IN ('Propietario','Administrador','Odontólogo','Especialista','Asistente','Recepción','Caja');
INSERT INTO role_permissions(organization_id,role_id,permission_code)
 SELECT organization_id,id,'catalogs.manage' FROM roles WHERE system AND name IN ('Propietario','Administrador');

CREATE TABLE professionals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 160), specialty text NOT NULL DEFAULT '',
 license text NOT NULL DEFAULT '', specialty_license text NOT NULL DEFAULT '',
 email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
 active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id)
);
CREATE INDEX professionals_name_idx ON professionals(organization_id,name,id);
CREATE UNIQUE INDEX professionals_license_idx ON professionals(organization_id,license) WHERE license<>'';
CREATE TABLE professional_branches (
 organization_id uuid NOT NULL, professional_id uuid NOT NULL, branch_id uuid NOT NULL,
 PRIMARY KEY(organization_id,professional_id,branch_id),
 FOREIGN KEY(organization_id,professional_id) REFERENCES professionals(organization_id,id),
 FOREIGN KEY(organization_id,branch_id) REFERENCES branches(organization_id,id)
);
CREATE INDEX professional_branches_branch_idx ON professional_branches(organization_id,branch_id,professional_id);
CREATE TABLE rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), branch_id uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 160), number text NOT NULL DEFAULT '',
 chair text NOT NULL DEFAULT '', equipment text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,branch_id,name),
 FOREIGN KEY(organization_id,branch_id) REFERENCES branches(organization_id,id)
);
CREATE INDEX rooms_branch_idx ON rooms(organization_id,branch_id,name,id);
CREATE TABLE services (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 160), code text NOT NULL CHECK(length(code) BETWEEN 1 AND 30),
 category text NOT NULL, specialty text NOT NULL DEFAULT '',
 duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 5 AND 480),
 price_minor integer NOT NULL CHECK(price_minor BETWEEN 0 AND 100000000),
 cost_minor integer NOT NULL DEFAULT 0 CHECK(cost_minor BETWEEN 0 AND 100000000),
 currency char(3) NOT NULL CHECK(currency IN ('MXN','USD','EUR')),
 requires_tooth boolean NOT NULL DEFAULT false, requires_consent boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,code),
 CHECK(category IN ('Preventiva','Restaurativa','Endodoncia','Cirugía','Ortodoncia','Periodoncia','Implantología','Prótesis','Estética','Diagnóstico','Otros'))
);
CREATE INDEX services_name_idx ON services(organization_id,name,id);
CREATE TABLE service_price_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, service_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES users(id), price_minor integer NOT NULL, cost_minor integer NOT NULL,
 currency char(3) NOT NULL, version integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,service_id) REFERENCES services(organization_id,id), UNIQUE(service_id,version)
);
CREATE INDEX service_price_history_idx ON service_price_history(organization_id,service_id,version DESC);
CREATE TRIGGER service_prices_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON service_price_history FOR EACH STATEMENT EXECUTE FUNCTION deny_audit_mutation();
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['professionals','professional_branches','rooms','services','service_price_history'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',table_name);
  EXECUTE format('CREATE POLICY catalog_tenant ON %I USING (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid) WITH CHECK (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid)',table_name);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON professionals,rooms,services TO alia_app;
GRANT SELECT,INSERT,DELETE ON professional_branches TO alia_app;
GRANT SELECT,INSERT ON service_price_history TO alia_app;
