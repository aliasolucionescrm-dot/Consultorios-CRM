CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE appointments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 request_id uuid NOT NULL, request_hash text NOT NULL, branch_id uuid NOT NULL,
 patient_id uuid NOT NULL, professional_id uuid NOT NULL, room_id uuid NOT NULL, service_id uuid NOT NULL,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, timezone text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','arrived','in_consultation','completed','canceled','no_show')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,branch_id) REFERENCES branches(organization_id,id),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 FOREIGN KEY(organization_id,professional_id) REFERENCES professionals(organization_id,id),
 FOREIGN KEY(organization_id,room_id) REFERENCES rooms(organization_id,id),
 FOREIGN KEY(organization_id,service_id) REFERENCES services(organization_id,id),
 CHECK(ends_at>=starts_at+interval '5 minutes' AND ends_at<=starts_at+interval '8 hours'),
 CONSTRAINT appointments_patient_overlap EXCLUDE USING gist (organization_id WITH =,patient_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(status NOT IN ('canceled','no_show')),
 CONSTRAINT appointments_professional_overlap EXCLUDE USING gist (organization_id WITH =,professional_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(status NOT IN ('canceled','no_show')),
 CONSTRAINT appointments_room_overlap EXCLUDE USING gist (organization_id WITH =,room_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(status NOT IN ('canceled','no_show'))
);
CREATE INDEX appointments_day_idx ON appointments(organization_id,branch_id,starts_at,id);
CREATE TABLE appointment_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,appointment_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES users(id),version integer NOT NULL,action text NOT NULL,reason text NOT NULL DEFAULT '',
 snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,appointment_id) REFERENCES appointments(organization_id,id),UNIQUE(appointment_id,version)
);
CREATE TRIGGER appointment_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON appointment_history FOR EACH STATEMENT EXECUTE FUNCTION deny_audit_mutation();
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['appointments','appointment_history'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',table_name);
  EXECUTE format('CREATE POLICY appointment_tenant ON %I USING (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid) WITH CHECK (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid)',table_name);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON appointments TO alia_app;
GRANT SELECT,INSERT ON appointment_history TO alia_app;
