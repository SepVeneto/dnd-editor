function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

const unsuccessfulResponseEventTypes = new Set([
  'error',
  'response.error',
  'response.failed',
  'response.incomplete',
])

/**
 * The Agents SDK replaces Responses terminal failures with a generic
 * `response.failed` error. Preserve the provider message from the raw event so
 * the UI can explain issues such as an invalid model or exhausted quota.
 */
export function providerStreamErrorMessage(data: unknown) {
  const streamEvent = asRecord(data)
  if (streamEvent.type !== 'model')
    return undefined

  const rawEvent = asRecord(streamEvent.event)
  const eventType = readString(rawEvent, 'type')
  if (!eventType || !unsuccessfulResponseEventTypes.has(eventType))
    return undefined

  const response = asRecord(rawEvent.response)
  const error = asRecord(response.error ?? rawEvent.error)
  const incompleteDetails = asRecord(response.incomplete_details)
  return readString(error, 'message')
    ?? readString(incompleteDetails, 'reason')
    ?? readString(rawEvent, 'message')
}
