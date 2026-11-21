CREATE TABLE IF NOT EXISTS bank_support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES bank_users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  customer_unread boolean NOT NULL DEFAULT false,
  admin_unread boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_support_conversation_status_check
    CHECK (status IN ('open', 'closed')),
  CONSTRAINT bank_support_conversation_subject_length_check
    CHECK (length(trim(subject)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS bank_support_conversation_user_recent_idx
  ON bank_support_conversations (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS bank_support_conversation_admin_queue_idx
  ON bank_support_conversations (status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS bank_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES bank_support_conversations(id) ON DELETE CASCADE,
  sender_user_id text NOT NULL,
  sender_role text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_support_message_sender_role_check
    CHECK (sender_role IN ('customer', 'admin')),
  CONSTRAINT bank_support_message_body_length_check
    CHECK (length(trim(body)) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS bank_support_message_conversation_created_idx
  ON bank_support_messages (conversation_id, created_at);
