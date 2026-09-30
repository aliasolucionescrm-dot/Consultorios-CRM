CREATE TABLE cash_counts (
 organization_id uuid NOT NULL,closure_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),id uuid NOT NULL DEFAULT gen_random_uuid(),request_id uuid NOT NULL,request_hash text NOT NULL,
 input jsonb NOT NULL,result jsonb NOT NULL,notes text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,closure_id,version),UNIQUE(organization_id,id),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,closure_id) REFERENCES cash_closures(organization_id,id)
);
ALTER TABLE cash_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_counts FORCE ROW LEVEL SECURITY;
CREATE POLICY cash_count_tenant ON cash_counts USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON cash_counts TO alia_app;
