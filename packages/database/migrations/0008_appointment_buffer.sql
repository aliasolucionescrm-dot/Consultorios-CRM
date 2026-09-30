ALTER TABLE appointments ADD COLUMN buffer_minutes integer NOT NULL DEFAULT 0 CHECK(buffer_minutes BETWEEN 0 AND 120);
ALTER TABLE appointments ADD COLUMN occupied_until timestamptz;
UPDATE appointments SET occupied_until=ends_at;
ALTER TABLE appointments ALTER COLUMN occupied_until SET NOT NULL;
CREATE FUNCTION set_appointment_occupied_until() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.occupied_until := NEW.ends_at + make_interval(mins => NEW.buffer_minutes);
 RETURN NEW;
END $$;
CREATE TRIGGER appointment_occupied_until BEFORE INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_appointment_occupied_until();
ALTER TABLE appointments DROP CONSTRAINT appointments_professional_overlap;
ALTER TABLE appointments DROP CONSTRAINT appointments_room_overlap;
ALTER TABLE appointments ADD CONSTRAINT appointments_professional_overlap EXCLUDE USING gist (organization_id WITH =,professional_id WITH =,tstzrange(starts_at,occupied_until,'[)') WITH &&) WHERE(status NOT IN ('canceled','no_show'));
ALTER TABLE appointments ADD CONSTRAINT appointments_room_overlap EXCLUDE USING gist (organization_id WITH =,room_id WITH =,tstzrange(starts_at,occupied_until,'[)') WITH &&) WHERE(status NOT IN ('canceled','no_show'));
