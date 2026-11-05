import type { AgentFileKind, FilePart } from './types'

export const AGENT_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024
export const AGENT_IMAGE_MAX_SIZE = 10 * 1024 * 1024
export const AGENT_ATTACHMENT_MAX_COUNT = 6
export const AGENT_ATTACHMENT_MAX_TOTAL_SIZE = 20 * 1024 * 1024
/** @deprecated Use the format-specific upload limits. */
export const AGENT_UPLOAD_MAX_SIZE = AGENT_DOCUMENT_MAX_SIZE

export interface AgentUploadedFile {
  /** Server-side upload id. */
  name: string
  /** Original file name. */
  file: string
  kind: AgentFileKind
  mimeType: string
  /** BFF URL used for thumbnails and previews. */
  url: string
  size?: number
}

interface AgentServiceResponse<T> {
  code?: number
  data?: T
  msg?: string
  message?: string
}

const imageMimeTypes = new Set([
  'image/bmp',
  'image/heic',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
])

const imageExtensions = new Set([
  '.bmp',
  '.heic',
  '.jpe',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp',
])

export function getAgentFileKind(
  file: Pick<File, 'name' | 'type'>,
): AgentFileKind | undefined {
  const name = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()
  if (name.endsWith('.docx'))
    return 'document'
  if (
    imageMimeTypes.has(mimeType)
    || [...imageExtensions].some(extension => name.endsWith(extension))
  ) {
    return 'image'
  }
  return undefined
}

export function isAgentImageFilePart(
  part: FilePart,
): boolean {
  return part.kind === 'image'
    || Boolean(part.mimeType?.toLowerCase().startsWith('image/'))
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

export async function uploadAgentFile(
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
  const kind = uploaded.kind ?? getAgentFileKind(file)
  if (!kind)
    throw new Error('无法识别上传文件的类型')

  return {
    ...uploaded,
    kind,
    mimeType: uploaded.mimeType || file.type,
    url: resolveAgentServiceURL(
      baseURL,
      `image?id=${encodeURIComponent(uploaded.name)}`,
    ),
    size: file.size,
  }
}

/** @deprecated Use uploadAgentFile. */
export const uploadAgentDocument = uploadAgentFile

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

export async function readAgentImageData(
  baseURL: string,
  uploaded: Pick<AgentUploadedFile, 'name'>,
): Promise<string> {
  const endpoint = resolveAgentServiceURL(baseURL, 'image-data')
  const response = await fetch(
    `${endpoint}?id=${encodeURIComponent(uploaded.name)}`,
  )

  return readResponse<string>(response)
}

export type AgentUserContent
  = | { type: 'input_image', image: string, detail: 'high' }
    | { type: 'input_text', text: string }

/**
 * Qwen's OpenAI-compatible API expects images and text in one user message.
 * Put images first so visual context is available when the model reads the
 * accompanying layout instructions.
 */
export function buildAgentUserContent(
  prompt: string,
  imageDataUrls: readonly string[],
): string | AgentUserContent[] {
  if (imageDataUrls.length === 0)
    return prompt

  return [
    ...imageDataUrls.map(image => ({
      type: 'input_image' as const,
      image,
      detail: 'high' as const,
    })),
    ...(prompt
      ? [{ type: 'input_text' as const, text: prompt }]
      : []),
  ]
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
