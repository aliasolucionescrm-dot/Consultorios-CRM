INSERT INTO permissions(code,description) VALUES ('budgets.view','Ver presupuestos'),('budgets.manage','Preparar presupuestos');
INSERT INTO role_permissions(organization_id,role_id,permission_code)
SELECT r.organization_id,r.id,p.code FROM roles r CROSS JOIN permissions p
WHERE r.system AND r.name IN ('Propietario','Administrador','Odontólogo') AND p.code IN ('budgets.view','budgets.manage') ON CONFLICT DO NOTHING;
CREATE TABLE patient_budget_versions (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 request_id uuid NOT NULL,plan_version integer NOT NULL,currency text NOT NULL CHECK(currency IN ('MXN','USD','EUR')),
 title text NOT NULL,items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),total_minor bigint NOT NULL CHECK(total_minor>=0),
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,patient_id,version),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,patient_id,plan_version) REFERENCES treatment_plan_versions(organization_id,patient_id,version)
);
ALTER TABLE patient_budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_budget_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY budget_tenant ON patient_budget_versions USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON patient_budget_versions TO alia_app;
