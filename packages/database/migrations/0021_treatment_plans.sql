CREATE TABLE treatment_plan_versions (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,patient_id,version),FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id)
);
ALTER TABLE treatment_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plan_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY treatment_plan_tenant ON treatment_plan_versions USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON treatment_plan_versions TO alia_app;
