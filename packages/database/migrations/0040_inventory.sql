CREATE TABLE inventory_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),request_id uuid NOT NULL,request_hash text NOT NULL,
 sku text NOT NULL,name text NOT NULL,unit text NOT NULL,minimum integer NOT NULL CHECK(minimum>=0),active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(organization_id,sku),UNIQUE(organization_id,request_id)
);
CREATE TABLE inventory_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,item_id uuid NOT NULL,branch_id uuid NOT NULL,
 quantity integer NOT NULL CHECK(quantity<>0),kind text NOT NULL CHECK(kind IN ('entry','exit','adjustment')),reason text NOT NULL,
 request_id uuid NOT NULL,request_hash text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,request_id),FOREIGN KEY(organization_id,item_id) REFERENCES inventory_items(organization_id,id),FOREIGN KEY(organization_id,branch_id) REFERENCES branches(organization_id,id)
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['inventory_items','inventory_movements'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY inventory_tenant ON %I USING(organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid) WITH CHECK(organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid)',t);
 END LOOP; END $$;
GRANT SELECT,INSERT,UPDATE ON inventory_items TO alia_app;
GRANT SELECT,INSERT ON inventory_movements TO alia_app;
CREATE TRIGGER inventory_movements_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_movements FOR EACH STATEMENT EXECUTE FUNCTION deny_audit_mutation();
CREATE INDEX inventory_movements_stock ON inventory_movements(organization_id,item_id,branch_id);
INSERT INTO role_permissions SELECT r.organization_id,r.id,p.code FROM roles r CROSS JOIN permissions p WHERE r.system AND r.name IN ('Propietario','Administrador') AND p.code IN ('inventory.view','inventory.edit') ON CONFLICT DO NOTHING;
