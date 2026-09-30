CREATE TABLE prescription_preparations (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,draft_id uuid NOT NULL,version integer NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),prepared_by uuid NOT NULL REFERENCES users(id),prepared_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,patient_id,draft_id),UNIQUE(organization_id,id),
 FOREIGN KEY(organization_id,patient_id,draft_id,version) REFERENCES prescription_drafts(organization_id,patient_id,id,version)
);
ALTER TABLE prescription_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_preparations FORCE ROW LEVEL SECURITY;
CREATE POLICY prescription_preparation_tenant ON prescription_preparations USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON prescription_preparations TO alia_app;
