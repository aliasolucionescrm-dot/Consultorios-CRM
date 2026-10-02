INSERT INTO permissions(code,description) VALUES('professional_shares.view','Consultar participación profesional'),('professional_shares.manage','Registrar participación profesional');
INSERT INTO role_permissions(organization_id,role_id,permission_code) SELECT r.organization_id,r.id,p.code FROM roles r CROSS JOIN permissions p WHERE r.system AND ((r.name IN ('Propietario','Administrador') AND p.code IN ('professional_shares.view','professional_shares.manage')) OR (r.name='Contabilidad' AND p.code='professional_shares.view')) ON CONFLICT DO NOTHING;
CREATE TABLE professional_shares (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),id uuid NOT NULL DEFAULT gen_random_uuid(),acceptance_id uuid NOT NULL,professional_id uuid NOT NULL,
 professional_name text NOT NULL,relationship text NOT NULL,percentage_bps integer NOT NULL CHECK(percentage_bps BETWEEN 0 AND 10000),base_minor bigint NOT NULL CHECK(base_minor>=0),amount_minor bigint NOT NULL CHECK(amount_minor>=0 AND amount_minor<=base_minor),currency text NOT NULL,
 notes text NOT NULL,request_id uuid NOT NULL,request_hash text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,patient_id,version),UNIQUE(organization_id,id),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 FOREIGN KEY(organization_id,acceptance_id) REFERENCES budget_acceptances(organization_id,id),
 FOREIGN KEY(organization_id,professional_id) REFERENCES professionals(organization_id,id)
);
ALTER TABLE professional_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_shares FORCE ROW LEVEL SECURITY;
CREATE POLICY professional_share_tenant ON professional_shares USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON professional_shares TO alia_app;
