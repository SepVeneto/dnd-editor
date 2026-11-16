const MAX_LIST_LIMIT = 100
const MAX_TEXT_LENGTH = 200

function asRecord(value) {
  return value && typeof value === 'object'
    ? value
    : {}
}

function messageText(message) {
  const parts = Array.isArray(message.parts) ? message.parts : []
  return parts
    .filter(part => part?.type === 'text' && typeof part.text === 'string')
    .map(part => part.text.trim())
    .filter(Boolean)
    .join(' ')
}

function normalizeText(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : ''
  return (text || fallback).slice(0, 240)
}

export function normalizeUserIdentity(value) {
  const userId = typeof value === 'string' ? value.trim() : ''
  if (!userId || userId.length > MAX_TEXT_LENGTH)
    return undefined
  return userId
}

export function normalizeNamespace(value) {
  const namespace = typeof value === 'string' ? value.trim() : ''
  return (namespace || 'dnd-agent-chat').slice(0, MAX_TEXT_LENGTH)
}

export function deriveConversationMetadata(input) {
  const value = asRecord(input)
  const messages = Array.isArray(value.messages) ? value.messages : []
  const firstUserMessage = messages.find(
    message => asRecord(message).role === 'user',
  )
  const firstText = firstUserMessage
    ? messageText(asRecord(firstUserMessage))
    : ''
  const preview = messages
    .map(message => messageText(asRecord(message)))
    .find(Boolean)
    ?? ''

  return {
    messages,
    title: normalizeText(value.title, firstText || '新会话').slice(0, 80),
    preview: normalizeText(value.preview, preview).slice(0, 160),
    messageCount: messages.length,
  }
}

function mapSummary(row) {
  return {
    id: row.id,
    namespace: row.namespace,
    mode: row.mode,
    title: row.title,
    preview: row.preview,
    messageCount: Number(row.message_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createConversationStore(pool) {
  return {
    async list({ userId, namespace, limit = 50 }) {
      const safeLimit = Math.min(
        Math.max(Number(limit) || 50, 1),
        MAX_LIST_LIMIT,
      )
      const result = await pool.query(
        `SELECT
           id,
           namespace,
           mode,
           title,
           preview,
           message_count,
           created_at,
           updated_at
         FROM agent_conversations
         WHERE user_id = $1 AND namespace = $2
         ORDER BY updated_at DESC
         LIMIT $3`,
        [userId, namespace, safeLimit],
      )
      return result.rows.map(mapSummary)
    },

    async get({ userId, namespace, id }) {
      const result = await pool.query(
        `SELECT
           id,
           namespace,
           mode,
           title,
           preview,
           message_count,
           messages,
           created_at,
           updated_at
         FROM agent_conversations
         WHERE user_id = $1 AND namespace = $2 AND id = $3
         LIMIT 1`,
        [userId, namespace, id],
      )
      const row = result.rows[0]
      if (!row)
        return undefined

      return {
        ...mapSummary(row),
        messages: Array.isArray(row.messages) ? row.messages : [],
      }
    },

    async save({
      userId,
      namespace,
      id,
      mode,
      title,
      preview,
      messages,
      messageCount,
    }) {
      const result = await pool.query(
        `INSERT INTO agent_conversations (
           id,
           user_id,
           namespace,
           mode,
           title,
           preview,
           message_count,
           messages,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           mode = EXCLUDED.mode,
           title = EXCLUDED.title,
           preview = EXCLUDED.preview,
           message_count = EXCLUDED.message_count,
           messages = EXCLUDED.messages,
           updated_at = NOW()
         WHERE agent_conversations.user_id = EXCLUDED.user_id
           AND agent_conversations.namespace = EXCLUDED.namespace
         RETURNING
           id,
           namespace,
           mode,
           title,
           preview,
           message_count,
           created_at,
           updated_at`,
        [
          id,
          userId,
          namespace,
          mode,
          title,
          preview,
          messageCount,
          JSON.stringify(messages),
        ],
      )
      const row = result.rows[0]
      return row ? mapSummary(row) : undefined
    },
  }
}

export const CONVERSATION_SCHEMA_SQL = `
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
`
