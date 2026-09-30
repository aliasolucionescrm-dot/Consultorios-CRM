ALTER TABLE professionals
 ADD COLUMN relationship text NOT NULL DEFAULT 'unspecified' CHECK(relationship IN ('unspecified','internal','external')),
 ADD COLUMN professional_title text NOT NULL DEFAULT '' CHECK(length(professional_title)<=80),
 ADD COLUMN training_institution text NOT NULL DEFAULT '' CHECK(length(training_institution)<=160),
 ADD COLUMN external_organization text NOT NULL DEFAULT '' CHECK(length(external_organization)<=160),
 ADD COLUMN practice_address text NOT NULL DEFAULT '' CHECK(length(practice_address)<=500);
