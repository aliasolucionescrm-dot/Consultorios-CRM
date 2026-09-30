CREATE TABLE prescription_drafts (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,id uuid NOT NULL,version integer NOT NULL CHECK(version>0),request_id uuid NOT NULL,
 input jsonb NOT NULL,snapshot jsonb NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,patient_id,id,version),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id)
);
ALTER TABLE prescription_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY prescription_draft_tenant ON prescription_drafts USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON prescription_drafts TO alia_app;
