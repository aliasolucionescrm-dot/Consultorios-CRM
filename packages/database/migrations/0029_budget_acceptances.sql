CREATE TABLE budget_acceptances (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,version integer NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL,request_hash text NOT NULL,accepted_by text NOT NULL CHECK(length(accepted_by)>0),relationship text NOT NULL CHECK(length(relationship)>0),notes text NOT NULL,
 snapshot jsonb NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,patient_id,version),UNIQUE(organization_id,id),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,patient_id,version) REFERENCES patient_budget_versions(organization_id,patient_id,version)
);
ALTER TABLE budget_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_acceptances FORCE ROW LEVEL SECURITY;
CREATE POLICY budget_acceptance_tenant ON budget_acceptances USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON budget_acceptances TO alia_app;
