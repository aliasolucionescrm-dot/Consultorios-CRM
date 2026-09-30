ALTER TABLE patient_attachments ADD COLUMN display_name text NOT NULL DEFAULT '' CHECK(length(display_name)<=100);
GRANT UPDATE(display_name) ON patient_attachments TO alia_app;
