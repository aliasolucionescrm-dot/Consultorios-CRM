ALTER TABLE professionals ADD COLUMN restrict_services boolean NOT NULL DEFAULT false;
CREATE TABLE professional_services (
 organization_id uuid NOT NULL, professional_id uuid NOT NULL, service_id uuid NOT NULL,
 PRIMARY KEY(organization_id,professional_id,service_id),
 FOREIGN KEY(organization_id,professional_id) REFERENCES professionals(organization_id,id),
 FOREIGN KEY(organization_id,service_id) REFERENCES services(organization_id,id)
);
ALTER TABLE professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_services FORCE ROW LEVEL SECURITY;
CREATE POLICY professional_services_tenant ON professional_services USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT,DELETE ON professional_services TO alia_app;
