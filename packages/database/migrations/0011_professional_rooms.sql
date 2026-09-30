ALTER TABLE professionals ADD COLUMN restrict_rooms boolean NOT NULL DEFAULT false;
CREATE TABLE professional_rooms (
 organization_id uuid NOT NULL, professional_id uuid NOT NULL, room_id uuid NOT NULL,
 PRIMARY KEY(organization_id,professional_id,room_id),
 FOREIGN KEY(organization_id,professional_id) REFERENCES professionals(organization_id,id),
 FOREIGN KEY(organization_id,room_id) REFERENCES rooms(organization_id,id)
);
ALTER TABLE professional_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_rooms FORCE ROW LEVEL SECURITY;
CREATE POLICY professional_rooms_tenant ON professional_rooms USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT,DELETE ON professional_rooms TO alia_app;
