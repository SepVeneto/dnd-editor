CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('data', 'text')),
  title TEXT NOT NULL,
  preview TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_conversations_user_updated_idx
  ON agent_conversations (user_id, namespace, updated_at DESC);
