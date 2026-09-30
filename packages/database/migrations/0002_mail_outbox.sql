CREATE TABLE mail_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid REFERENCES organizations(id),
 user_id uuid REFERENCES users(id),
 kind text NOT NULL CHECK (kind IN ('reset','invite')),
 entity_id uuid NOT NULL,
 payload_ciphertext text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 available_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 sent_at timestamptz,
 last_error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(kind,entity_id),
 CHECK(status='pending' OR payload_ciphertext IS NULL)
);
CREATE INDEX mail_outbox_pending_idx ON mail_outbox(available_at,created_at) WHERE status='pending';
CREATE INDEX mail_outbox_org_idx ON mail_outbox(organization_id,created_at DESC);
