CREATE TABLE consent_events (
 organization_id uuid NOT NULL,consent_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),version integer NOT NULL CHECK(version>0),request_id uuid NOT NULL,
 request_hash text NOT NULL,status text NOT NULL CHECK(status IN ('accepted','rejected','voided')),reason text NOT NULL,signer_name text NOT NULL DEFAULT '',signer_relationship text NOT NULL DEFAULT '',occurred_on date NOT NULL,evidence jsonb,
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,consent_id,version),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,consent_id) REFERENCES patient_consents(organization_id,id),CHECK(status<>'accepted' OR (evidence IS NOT NULL AND length(signer_name)>0))
);
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_events FORCE ROW LEVEL SECURITY;
CREATE POLICY consent_event_tenant ON consent_events USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON consent_events TO alia_app;
