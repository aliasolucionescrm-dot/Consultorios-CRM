ALTER TABLE patient_attachments DROP CONSTRAINT patient_attachments_media_type_check;
ALTER TABLE patient_attachments ADD CONSTRAINT patient_attachments_media_type_check
 CHECK(media_type IN ('image/png','image/jpeg','image/webp','application/pdf'));
