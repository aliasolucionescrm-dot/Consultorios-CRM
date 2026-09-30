CREATE TABLE patient_relations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
 patient_id uuid NOT NULL, relative_id uuid NOT NULL,
 relationship text NOT NULL CHECK(relationship IN ('parent','child','sibling','partner','grandparent','grandchild','other')),
 active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,patient_id) REFERENCES patients(organization_id,id),
 FOREIGN KEY(organization_id,relative_id) REFERENCES patients(organization_id,id),
 CHECK(patient_id<>relative_id)
);
CREATE UNIQUE INDEX patient_relations_pair ON patient_relations(organization_id,least(patient_id,relative_id),greatest(patient_id,relative_id)) WHERE active;
ALTER TABLE patient_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_relations FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_relations_tenant ON patient_relations USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON patient_relations TO alia_app;
