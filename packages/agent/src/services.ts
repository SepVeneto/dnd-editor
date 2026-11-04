import type { FilePart } from './types'

export const AGENT_UPLOAD_MAX_SIZE = 10 * 1024 * 1024

export interface AgentUploadedFile {
  /** Server-side upload id. */
  name: string
  /** Original file name. */
  file: string
  size?: number
}

interface AgentServiceResponse<T> {
  code?: number
  data?: T
  msg?: string
  message?: string
}

/**
 * Model APIs normally live under `/v1`, while upload and document conversion
 * endpoints live at the BFF root. Keep any deployment prefix in the base URL.
 */
export function resolveAgentServiceURL(baseURL: string, path: string): string {
  const serviceBaseURL = baseURL
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '')

  return `${serviceBaseURL}/${path.replace(/^\/+/, '')}`
}

async function readResponse<T>(response: Response): Promise<T> {
  let result: AgentServiceResponse<T> | undefined
  try {
    result = await response.json() as AgentServiceResponse<T>
  }
  catch {
    // A non-JSON response is reported below with its HTTP status.
  }

  if (!response.ok || result?.code !== 0 || result.data === undefined) {
    throw new Error(
      result?.message
      ?? result?.msg
      ?? `文件服务请求失败（HTTP ${response.status}）`,
    )
  }

  return result.data
}

export async function uploadAgentDocument(
  baseURL: string,
  file: File,
): Promise<AgentUploadedFile> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(resolveAgentServiceURL(baseURL, 'upload'), {
    method: 'POST',
    body: formData,
  })
  const uploaded = await readResponse<AgentUploadedFile>(response)

  return {
    ...uploaded,
    size: file.size,
  }
}

export async function readAgentDocumentMarkdown(
  baseURL: string,
  uploaded: AgentUploadedFile,
): Promise<string> {
  const endpoint = resolveAgentServiceURL(baseURL, 'docx-markdown')
  const response = await fetch(
    `${endpoint}?id=${encodeURIComponent(uploaded.name)}`,
  )

  return readResponse<string>(response)
}

export function formatAgentDocumentContext(file: FilePart): string {
  if (!file.text?.trim())
    return ''

  return [
    `<attached_document name="${file.file.replace(/"/g, '&quot;')}">`,
    file.text,
    '</attached_document>',
  ].join('\n')
}
