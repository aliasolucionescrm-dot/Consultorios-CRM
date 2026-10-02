CREATE TABLE patient_referral_versions (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 professional_id uuid NOT NULL,professional_name text NOT NULL,reason text NOT NULL,
 state text NOT NULL CHECK(state IN ('requested','attended','returned','canceled')),notes text NOT NULL,report text NOT NULL,
 request_id uuid NOT NULL,request_hash text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id,version),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 FOREIGN KEY(organization_id,professional_id) REFERENCES professionals(organization_id,id)
);
ALTER TABLE patient_referral_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_referral_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY referrals_tenant ON patient_referral_versions USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
CREATE TRIGGER referrals_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON patient_referral_versions FOR EACH STATEMENT EXECUTE FUNCTION deny_audit_mutation();
GRANT SELECT,INSERT ON patient_referral_versions TO alia_app;
CREATE INDEX referrals_patient ON patient_referral_versions(organization_id,patient_id,id,version DESC);
