CREATE TABLE consent_template_versions (
 organization_id uuid NOT NULL REFERENCES organizations(id),id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 title text NOT NULL,category text NOT NULL CHECK(category IN ('orthodontics','endodontics','surgery','extraction','other')),
 status text NOT NULL CHECK(status IN ('draft','available','retired')),content text NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id,version)
);
CREATE TABLE patient_consents (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),request_id uuid NOT NULL,
 template_id uuid NOT NULL,template_version integer NOT NULL,plan_version integer NOT NULL,plan_item_id uuid NOT NULL,
 professional_id uuid NOT NULL,snapshot jsonb NOT NULL,notes text NOT NULL DEFAULT '',created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 FOREIGN KEY(organization_id,template_id,template_version) REFERENCES consent_template_versions(organization_id,id,version),
 FOREIGN KEY(organization_id,patient_id,plan_version) REFERENCES treatment_plan_versions(organization_id,patient_id,version),
 FOREIGN KEY(organization_id,professional_id) REFERENCES professionals(organization_id,id)
);
ALTER TABLE consent_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_template_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY consent_template_tenant ON consent_template_versions USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
ALTER TABLE patient_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_consents FORCE ROW LEVEL SECURITY;
CREATE POLICY consent_patient_tenant ON patient_consents USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON consent_template_versions,patient_consents TO alia_app;
