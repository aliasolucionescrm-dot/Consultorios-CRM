CREATE TABLE appointment_series (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 request_id uuid NOT NULL,request_hash text NOT NULL,appointment_ids uuid[] NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,request_id),UNIQUE(organization_id,id)
);
ALTER TABLE appointment_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_series FORCE ROW LEVEL SECURITY;
CREATE POLICY series_tenant ON appointment_series USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON appointment_series TO alia_app;
ALTER TABLE appointments ADD COLUMN series_id uuid;
ALTER TABLE appointments ADD FOREIGN KEY(organization_id,series_id) REFERENCES appointment_series(organization_id,id);
CREATE INDEX appointments_series_idx ON appointments(organization_id,series_id) WHERE series_id IS NOT NULL;
