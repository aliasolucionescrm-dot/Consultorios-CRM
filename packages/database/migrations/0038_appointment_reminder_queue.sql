-- Durable preparation only: no sender consumes these records in this release.
CREATE TABLE appointment_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,patient_id uuid NOT NULL,
 appointment_id uuid NOT NULL,appointment_version integer NOT NULL,preference_version integer NOT NULL,
 channel text NOT NULL CHECK(channel IN ('email','whatsapp')),destination text NOT NULL,
 starts_at timestamptz NOT NULL,due_at timestamptz NOT NULL,timezone text NOT NULL,
 state text NOT NULL DEFAULT 'held' CHECK(state IN ('held','canceled','expired')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,appointment_id,appointment_version,preference_version,channel),
 FOREIGN KEY(organization_id,appointment_id) REFERENCES appointments(organization_id,id),
 FOREIGN KEY(organization_id,patient_id,preference_version) REFERENCES patient_reminder_preferences(organization_id,patient_id,version),
 CHECK(due_at=starts_at-interval '24 hours')
);
CREATE INDEX appointment_reminders_patient_idx ON appointment_reminders(organization_id,patient_id,created_at DESC,id);
CREATE INDEX appointment_reminders_due_idx ON appointment_reminders(organization_id,due_at) WHERE state='held';
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_reminders FORCE ROW LEVEL SECURITY;
CREATE POLICY reminder_queue_tenant ON appointment_reminders USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON appointment_reminders TO alia_app;

CREATE FUNCTION reconcile_patient_reminders(tenant uuid,patient uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE pref patient_reminder_preferences%ROWTYPE; person patients%ROWTYPE;
BEGIN
 -- Shared by every source mutation; after waiting, each query sees committed sources.
 PERFORM pg_advisory_xact_lock(hashtextextended(tenant::text||':reminder-queue:'||patient::text,0));
 SELECT * INTO person FROM patients WHERE organization_id=tenant AND id=patient;
 SELECT * INTO pref FROM patient_reminder_preferences WHERE organization_id=tenant AND patient_id=patient ORDER BY version DESC LIMIT 1;
 UPDATE appointment_reminders q SET state='canceled',updated_at=clock_timestamp()
 WHERE q.organization_id=tenant AND q.patient_id=patient AND q.state='held' AND NOT EXISTS(
  SELECT 1 FROM appointments a WHERE a.organization_id=tenant AND a.id=q.appointment_id
  AND a.patient_id=patient AND a.version=q.appointment_version AND a.starts_at=q.starts_at AND a.timezone=q.timezone
  AND a.status IN ('pending','confirmed') AND person.active AND pref.version=q.preference_version
  AND ((q.channel='email' AND pref.email_enabled AND pref.email=lower(btrim(person.email)) AND q.destination=pref.email)
    OR (q.channel='whatsapp' AND pref.whatsapp_enabled AND pref.whatsapp=regexp_replace(person.whatsapp,'[[:space:]().-]','','g') AND q.destination=pref.whatsapp))
 );
 UPDATE appointment_reminders SET state='expired',updated_at=clock_timestamp()
 WHERE organization_id=tenant AND patient_id=patient AND state='held' AND due_at<=clock_timestamp();
 IF NOT coalesce(person.active,false) OR pref.version IS NULL THEN RETURN; END IF;
 INSERT INTO appointment_reminders(organization_id,patient_id,appointment_id,appointment_version,preference_version,channel,destination,starts_at,due_at,timezone)
 SELECT tenant,patient,a.id,a.version,pref.version,ch.channel,ch.destination,a.starts_at,a.starts_at-interval '24 hours',a.timezone
 FROM appointments a CROSS JOIN LATERAL (VALUES
 ('email',pref.email,pref.email_enabled AND pref.email=lower(btrim(person.email))),
 ('whatsapp',pref.whatsapp,pref.whatsapp_enabled AND pref.whatsapp=regexp_replace(person.whatsapp,'[[:space:]().-]','','g'))
 ) ch(channel,destination,enabled)
 WHERE a.organization_id=tenant AND a.patient_id=patient AND a.status IN ('pending','confirmed')
 AND a.starts_at-interval '24 hours'>clock_timestamp() AND ch.enabled
 ON CONFLICT(organization_id,appointment_id,appointment_version,preference_version,channel) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION reconcile_patient_reminders(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reconcile_patient_reminders(uuid,uuid) TO alia_app;

CREATE FUNCTION reminder_source_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='patients' THEN PERFORM reconcile_patient_reminders(NEW.organization_id,NEW.id);
 ELSE PERFORM reconcile_patient_reminders(NEW.organization_id,NEW.patient_id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER appointment_reminder_source AFTER INSERT OR UPDATE OF version,status,starts_at,timezone ON appointments FOR EACH ROW EXECUTE FUNCTION reminder_source_changed();
CREATE TRIGGER preference_reminder_source AFTER INSERT ON patient_reminder_preferences FOR EACH ROW EXECUTE FUNCTION reminder_source_changed();
CREATE TRIGGER patient_reminder_source AFTER UPDATE OF email,whatsapp,active ON patients FOR EACH ROW EXECUTE FUNCTION reminder_source_changed();

-- Backfill authorized patients, retaining RLS scope even for non-superuser migration roles.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT DISTINCT organization_id,patient_id FROM patient_reminder_preferences LOOP
  PERFORM set_config('app.organization_id',p.organization_id::text,true);
  PERFORM reconcile_patient_reminders(p.organization_id,p.patient_id);
 END LOOP;
END $$;
