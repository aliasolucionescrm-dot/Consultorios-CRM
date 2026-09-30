CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE FUNCTION patient_search_normalize(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
 SELECT lower(translate(value,'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'));
$$;
CREATE TABLE patients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES organizations(id),
 request_id uuid NOT NULL,
 request_hash text NOT NULL,
 record_number text NOT NULL,
 first_name text NOT NULL CHECK(length(first_name) BETWEEN 1 AND 100),
 last_name text NOT NULL CHECK(length(last_name) BETWEEN 1 AND 150),
 birth_date date CHECK(birth_date >= DATE '1850-01-01'),
 sex text NOT NULL DEFAULT 'not_specified' CHECK(sex IN ('female','male','other','not_specified')),
 phone text NOT NULL DEFAULT '', whatsapp text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
 address text NOT NULL DEFAULT '', occupation text NOT NULL DEFAULT '',
 emergency_name text NOT NULL DEFAULT '', emergency_phone text NOT NULL DEFAULT '',
 guardian_name text NOT NULL DEFAULT '', guardian_relationship text NOT NULL DEFAULT '',
 fiscal_name text NOT NULL DEFAULT '', fiscal_rfc text NOT NULL DEFAULT '', fiscal_postal_code text NOT NULL DEFAULT '',
 administrative_notes text NOT NULL DEFAULT '', tags text[] NOT NULL DEFAULT '{}',
 active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 search_text text GENERATED ALWAYS AS (patient_search_normalize(first_name||' '||last_name||' '||email||' '||record_number||' '||regexp_replace(phone,'[^0-9]','','g')||' '||regexp_replace(whatsapp,'[^0-9]','','g'))) STORED,
 UNIQUE(organization_id,id), UNIQUE(organization_id,request_id), UNIQUE(organization_id,record_number),
 CHECK(cardinality(tags)<=10)
);
CREATE INDEX patients_name_idx ON patients(organization_id,last_name,first_name,id);
CREATE INDEX patients_phone_idx ON patients(organization_id,phone);
CREATE INDEX patients_email_idx ON patients(organization_id,email);
CREATE INDEX patients_search_idx ON patients USING gin(search_text gin_trgm_ops);
CREATE INDEX patients_active_name_idx ON patients(organization_id,last_name,first_name,id) WHERE active;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
CREATE POLICY patients_tenant ON patients
 USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid)
 WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON patients TO alia_app;
-- Deactivation preserves references. There is intentionally no DELETE privilege.
