ALTER TABLE odontogram_versions ADD COLUMN diagnosis text NOT NULL DEFAULT '' CHECK(length(diagnosis)<=3000);
