INSERT INTO permissions(code,description) VALUES('professional_payments.create','Registrar pagos al profesional'),('professional_payments.void','Anular capturas erróneas de pagos al profesional');
INSERT INTO role_permissions(organization_id,role_id,permission_code) SELECT r.organization_id,r.id,p.code FROM roles r CROSS JOIN permissions p WHERE r.system AND r.name IN ('Propietario','Administrador') AND p.code IN ('professional_payments.create','professional_payments.void') ON CONFLICT DO NOTHING;
CREATE TABLE professional_payments (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),share_id uuid NOT NULL,
 request_id uuid NOT NULL,request_hash text NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),
 kind text NOT NULL CHECK(kind IN ('installment','settlement')),method text NOT NULL CHECK(method IN ('cash','transfer','other')),
 branch_id uuid NOT NULL,branch_name text NOT NULL,reference text NOT NULL,notes text NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 FOREIGN KEY(organization_id,share_id) REFERENCES professional_shares(organization_id,id),
 FOREIGN KEY(organization_id,branch_id) REFERENCES branches(organization_id,id)
);
CREATE TABLE professional_payment_voids (
 organization_id uuid NOT NULL,payment_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),request_id uuid NOT NULL,request_hash text NOT NULL,
 reason text NOT NULL CHECK(length(reason)>0),created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,payment_id),UNIQUE(organization_id,id),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,payment_id) REFERENCES professional_payments(organization_id,id)
);
CREATE INDEX professional_payments_history ON professional_payments(organization_id,patient_id,created_at DESC,id);
ALTER TABLE professional_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE professional_payment_voids ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_payment_voids FORCE ROW LEVEL SECURITY;
CREATE POLICY professional_payment_tenant ON professional_payments USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
CREATE POLICY professional_payment_void_tenant ON professional_payment_voids USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON professional_payments,professional_payment_voids TO alia_app;
