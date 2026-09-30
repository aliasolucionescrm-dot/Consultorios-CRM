CREATE TABLE room_schedules (
 organization_id uuid NOT NULL,room_id uuid NOT NULL,
 weekly jsonb NOT NULL CHECK(jsonb_typeof(weekly)='array'),version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,room_id),
 FOREIGN KEY(organization_id,room_id) REFERENCES rooms(organization_id,id)
);
ALTER TABLE room_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_schedules FORCE ROW LEVEL SECURITY;
CREATE POLICY room_schedules_tenant ON room_schedules USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON room_schedules TO alia_app;
