INSERT INTO permissions(code,description) VALUES('payments.void','Anular registros de pago erróneos');
INSERT INTO role_permissions(organization_id,role_id,permission_code)
SELECT r.organization_id,r.id,p.code FROM roles r CROSS JOIN permissions p WHERE r.system AND
((r.name IN ('Propietario','Administrador') AND p.code IN ('payments.view','payments.create','payments.void','patients.view')) OR (r.name IN ('Caja','Contabilidad') AND p.code='patients.view')) ON CONFLICT DO NOTHING;
CREATE TABLE patient_payments (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),acceptance_id uuid NOT NULL,
 request_id uuid NOT NULL,request_hash text NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),
 kind text NOT NULL CHECK(kind IN ('advance','installment','settlement')),method text NOT NULL CHECK(method IN ('cash','card','transfer','other')),
 branch_id uuid NOT NULL,branch_name text NOT NULL,reference text NOT NULL,notes text NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 FOREIGN KEY(organization_id,acceptance_id) REFERENCES budget_acceptances(organization_id,id),
 FOREIGN KEY(organization_id,branch_id) REFERENCES branches(organization_id,id)
);
CREATE TABLE payment_voids (
 organization_id uuid NOT NULL,payment_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),request_id uuid NOT NULL,request_hash text NOT NULL,
 reason text NOT NULL CHECK(length(reason)>0),created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,payment_id),UNIQUE(organization_id,id),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,payment_id) REFERENCES patient_payments(organization_id,id)
);
CREATE INDEX patient_payments_history ON patient_payments(organization_id,patient_id,created_at DESC,id);
ALTER TABLE patient_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_voids ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_voids FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_tenant ON patient_payments USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
CREATE POLICY payment_void_tenant ON payment_voids USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON patient_payments,payment_voids TO alia_app;
