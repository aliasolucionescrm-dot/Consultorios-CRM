CREATE TABLE budget_credit_transfers (
 organization_id uuid NOT NULL,patient_id uuid NOT NULL,from_acceptance_id uuid NOT NULL,to_acceptance_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>=0),created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,to_acceptance_id),UNIQUE(organization_id,from_acceptance_id),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 FOREIGN KEY(organization_id,from_acceptance_id) REFERENCES budget_acceptances(organization_id,id),FOREIGN KEY(organization_id,to_acceptance_id) REFERENCES budget_acceptances(organization_id,id),CHECK(from_acceptance_id<>to_acceptance_id)
);
CREATE TABLE patient_refunds (
 id uuid NOT NULL DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,patient_id uuid NOT NULL,payment_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),method text NOT NULL CHECK(method IN ('cash','card','transfer','other')),branch_id uuid NOT NULL,currency text NOT NULL,
 reason text NOT NULL,reference text NOT NULL,request_id uuid NOT NULL,request_hash text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,request_id),FOREIGN KEY(organization_id,payment_id) REFERENCES patient_payments(organization_id,id),FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),FOREIGN KEY(organization_id,branch_id) REFERENCES branches(organization_id,id)
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['budget_credit_transfers','patient_refunds'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY finance_adjustments_tenant ON %I USING(organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid) WITH CHECK(organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid)',t);
 EXECUTE format('CREATE TRIGGER adjustments_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION deny_audit_mutation()',t);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO alia_app',t);
 END LOOP; END $$;
INSERT INTO permissions VALUES('payments.refund','Registrar devoluciones al paciente');
INSERT INTO role_permissions SELECT r.organization_id,r.id,'payments.refund' FROM roles r WHERE r.system AND r.name IN ('Propietario','Administrador') ON CONFLICT DO NOTHING;
