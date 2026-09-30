CREATE TABLE patient_attachments (
 id uuid PRIMARY KEY,organization_id uuid NOT NULL,patient_id uuid NOT NULL,
 request_id uuid NOT NULL,request_hash text NOT NULL,
 filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 180),
 media_type text NOT NULL CHECK(media_type IN ('image/png','image/jpeg','application/pdf')),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 10485760),sha256 text NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 UNIQUE(organization_id,request_id)
);
CREATE INDEX patient_attachments_list ON patient_attachments(organization_id,patient_id,created_at,id);
ALTER TABLE patient_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_attachments_tenant ON patient_attachments USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON patient_attachments TO alia_app;
