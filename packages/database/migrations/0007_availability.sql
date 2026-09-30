CREATE TABLE professional_schedules (
 organization_id uuid NOT NULL, professional_id uuid NOT NULL, branch_id uuid NOT NULL,
 weekly jsonb NOT NULL CHECK(jsonb_typeof(weekly)='array'),version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,professional_id,branch_id),
 FOREIGN KEY(organization_id,professional_id) REFERENCES professionals(organization_id,id),
 FOREIGN KEY(organization_id,branch_id) REFERENCES branches(organization_id,id)
);
CREATE TABLE availability_blocks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,branch_id uuid NOT NULL,
 professional_id uuid,room_id uuid,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(professional_id,room_id)=1),CHECK(ends_at>starts_at),
 FOREIGN KEY(organization_id,branch_id) REFERENCES branches(organization_id,id),
 FOREIGN KEY(organization_id,professional_id) REFERENCES professionals(organization_id,id),
 FOREIGN KEY(organization_id,room_id) REFERENCES rooms(organization_id,id)
);
CREATE INDEX availability_blocks_period ON availability_blocks(organization_id,starts_at,ends_at) WHERE active;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['professional_schedules','availability_blocks'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY availability_tenant ON %I USING (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid) WITH CHECK (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON professional_schedules,availability_blocks TO alia_app;
