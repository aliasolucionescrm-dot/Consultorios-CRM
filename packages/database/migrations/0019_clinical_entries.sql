CREATE TABLE clinical_entries (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, patient_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('summary','note')), version integer NOT NULL CHECK(version>0),
 request_id uuid NOT NULL, payload jsonb NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 UNIQUE(organization_id,request_id), UNIQUE(organization_id,patient_id,kind,version)
);
ALTER TABLE clinical_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY clinical_entries_tenant ON clinical_entries USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON clinical_entries TO alia_app;
