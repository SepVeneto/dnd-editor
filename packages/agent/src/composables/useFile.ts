import type { Ref } from 'vue'
import type { AgentUploadedFile } from '../services'
import { ref, shallowRef } from 'vue'
import {
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

  function selectFile() {
    if (!uploading.value)
      fileInput.value?.click()
  }

  async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file)
      return

    error.value = ''
    const kind = getAgentFileKind(file)
    if (!kind) {
      error.value = '目前支持 .docx 文档及 JPG、PNG、WebP 等图片'
      input.value = ''
      return
    }
    const maxSize = kind === 'image'
      ? AGENT_IMAGE_MAX_SIZE
      : AGENT_DOCUMENT_MAX_SIZE
    if (file.size > maxSize) {
      error.value = `${kind === 'image' ? '图片' : '文档'}不能超过 10 MB`
      input.value = ''
      return
    }

    uploading.value = true
    try {
      list.value = [await uploadAgentFile(getBaseURL(), file)]
    }
    catch (uploadError) {
      list.value = []
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
  }
}
