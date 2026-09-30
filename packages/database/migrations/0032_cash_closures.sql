INSERT INTO permissions(code,description) VALUES('cash_closures.view','Consultar cortes de caja'),('cash_closures.create','Guardar cortes de caja');
INSERT INTO role_permissions(organization_id,role_id,permission_code) SELECT r.organization_id,r.id,p.code FROM roles r CROSS JOIN permissions p WHERE r.system AND ((r.name IN ('Propietario','Administrador','Caja') AND p.code IN ('cash_closures.view','cash_closures.create')) OR (r.name='Contabilidad' AND p.code='cash_closures.view')) ON CONFLICT DO NOTHING;
CREATE TABLE cash_closures (
 organization_id uuid NOT NULL REFERENCES organizations(id),id uuid NOT NULL DEFAULT gen_random_uuid(),request_id uuid NOT NULL,request_hash text NOT NULL,
 snapshot jsonb NOT NULL,notes text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,request_id)
);
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closures FORCE ROW LEVEL SECURITY;
CREATE POLICY cash_closure_tenant ON cash_closures USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON cash_closures TO alia_app;
