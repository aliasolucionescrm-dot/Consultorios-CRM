ALTER TABLE patient_attachments ADD COLUMN clinical boolean NOT NULL DEFAULT false;
ALTER TABLE patient_attachments ADD CONSTRAINT patient_attachments_org_id UNIQUE(organization_id,id);
CREATE TABLE photo_annotations (
 organization_id uuid NOT NULL,attachment_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 marks jsonb NOT NULL CHECK(jsonb_typeof(marks)='array'),
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,attachment_id,version),
 FOREIGN KEY(organization_id,attachment_id) REFERENCES patient_attachments(organization_id,id)
);
ALTER TABLE photo_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_annotations FORCE ROW LEVEL SECURITY;
CREATE POLICY photo_annotations_tenant ON photo_annotations USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON photo_annotations TO alia_app;
