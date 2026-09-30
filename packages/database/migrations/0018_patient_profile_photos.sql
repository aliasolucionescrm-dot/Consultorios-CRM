CREATE TABLE patient_profile_photos (
 organization_id uuid NOT NULL, patient_id uuid NOT NULL, attachment_id uuid,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(organization_id,patient_id),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 FOREIGN KEY(organization_id,attachment_id) REFERENCES patient_attachments(organization_id,id)
);
ALTER TABLE patient_profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_profile_photos FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_profile_photos_tenant ON patient_profile_photos USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON patient_profile_photos TO alia_app;
