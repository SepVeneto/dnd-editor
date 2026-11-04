import type { Ref } from 'vue'
import type { AgentUploadedFile } from '../services'
import { ref, shallowRef } from 'vue'
import {
  AGENT_UPLOAD_MAX_SIZE,
  uploadAgentDocument,
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
    if (!file.name.toLowerCase().endsWith('.docx')) {
      error.value = '目前仅支持上传 .docx 文档'
      input.value = ''
      return
    }
    if (file.size > AGENT_UPLOAD_MAX_SIZE) {
      error.value = '文档不能超过 10 MB'
      input.value = ''
      return
    }

    uploading.value = true
    try {
      list.value = [await uploadAgentDocument(getBaseURL(), file)]
    }
    catch (uploadError) {
      list.value = []
      error.value = uploadError instanceof Error
        ? uploadError.message
        : '文档上传失败'
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
