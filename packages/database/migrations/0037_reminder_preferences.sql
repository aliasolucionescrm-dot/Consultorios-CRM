CREATE TABLE patient_reminder_preferences (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 email_enabled boolean NOT NULL,whatsapp_enabled boolean NOT NULL,email text NOT NULL,whatsapp text NOT NULL,
 offsets_hours integer[] NOT NULL,notes text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,patient_id,version),FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id)
);
ALTER TABLE patient_reminder_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_reminder_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY reminder_preferences_tenant ON patient_reminder_preferences USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON patient_reminder_preferences TO alia_app;
