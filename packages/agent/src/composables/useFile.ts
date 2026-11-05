import type { Ref } from 'vue'
import type { AgentUploadedFile } from '../services'
import { ref, shallowRef } from 'vue'
import {
  AGENT_ATTACHMENT_MAX_COUNT,
  AGENT_ATTACHMENT_MAX_TOTAL_SIZE,
  AGENT_DOCUMENT_MAX_SIZE,
  AGENT_IMAGE_MAX_SIZE,
  getAgentFileKind,
  uploadAgentFile,
} from '../services'

export function useFile(
  fileInput: Readonly<Ref<HTMLInputElement | null>>,
  getBaseURL: () => string,
) {
  const list = shallowRef<AgentUploadedFile[]>([])
  const uploading = ref(false)
  const error = ref('')

  function reset() {
    list.value = []
    error.value = ''
    if (fileInput.value)
      fileInput.value.value = ''
  }

  function remove(name: string) {
    list.value = list.value.filter(file => file.name !== name)
    error.value = ''
  }

  function selectFile() {
    if (!uploading.value)
      fileInput.value?.click()
  }

  async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    if (files.length === 0)
      return

    error.value = ''
    if (list.value.length + files.length > AGENT_ATTACHMENT_MAX_COUNT) {
      error.value = `最多添加 ${AGENT_ATTACHMENT_MAX_COUNT} 个附件`
      input.value = ''
      return
    }

    for (const file of files) {
      const kind = getAgentFileKind(file)
      if (!kind) {
        error.value = `${file.name} 不是支持的文件类型`
        input.value = ''
        return
      }
      const maxSize = kind === 'image'
        ? AGENT_IMAGE_MAX_SIZE
        : AGENT_DOCUMENT_MAX_SIZE
      if (file.size > maxSize) {
        error.value = `${file.name} 不能超过 10 MB`
        input.value = ''
        return
      }
    }

    const totalSize = list.value.reduce(
      (total, file) => total + (file.size ?? 0),
      0,
    ) + files.reduce((total, file) => total + file.size, 0)
    if (totalSize > AGENT_ATTACHMENT_MAX_TOTAL_SIZE) {
      error.value = '附件总大小不能超过 20 MB'
      input.value = ''
      return
    }

    uploading.value = true
    try {
      const uploaded = await Promise.all(
        files.map(file => uploadAgentFile(getBaseURL(), file)),
      )
      list.value = [...list.value, ...uploaded]
    }
    catch (uploadError) {
      error.value = uploadError instanceof Error
        ? uploadError.message
        : '文件上传失败'
    }
    finally {
      uploading.value = false
      input.value = ''
    }
  }

  return {
    list,
    uploading,
    error,
    selectFile,
    handleFileChange,
    reset,
    remove,
  }
}
