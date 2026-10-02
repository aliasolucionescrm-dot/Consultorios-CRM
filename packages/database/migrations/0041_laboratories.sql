CREATE TABLE laboratories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),name text NOT NULL,contact text NOT NULL,phone text NOT NULL,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,
 UNIQUE(organization_id,id),UNIQUE(organization_id,name)
);
CREATE TABLE laboratory_order_versions (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 laboratory_id uuid NOT NULL,laboratory_name text NOT NULL,branch_id uuid NOT NULL,description text NOT NULL,due_date date NOT NULL,
 state text NOT NULL CHECK(state IN ('requested','sent','received','delivered','canceled')),notes text NOT NULL,report text NOT NULL,
 request_id uuid NOT NULL,request_hash text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id,version),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),FOREIGN KEY(organization_id,laboratory_id) REFERENCES laboratories(organization_id,id),FOREIGN KEY(organization_id,branch_id) REFERENCES branches(organization_id,id)
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['laboratories','laboratory_order_versions'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY lab_tenant ON %I USING(organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid) WITH CHECK(organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid)',t);
 END LOOP; END $$;
GRANT SELECT,INSERT,UPDATE ON laboratories TO alia_app;
GRANT SELECT,INSERT ON laboratory_order_versions TO alia_app;
CREATE TRIGGER lab_orders_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON laboratory_order_versions FOR EACH STATEMENT EXECUTE FUNCTION deny_audit_mutation();
CREATE INDEX lab_orders_patient ON laboratory_order_versions(organization_id,patient_id,id,version DESC);
