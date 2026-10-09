import { shallowRef, Ref } from "vue";

export function useFile(file: Ref<HTMLInputElement | null>) {
  const list = shallowRef<{ name: string, file: string }[]>([])

  function reset() {
    list.value = []
  }
  function selectFile() {
    file.value?.click()
  }

  async function handleFileChange(e: Event) {
    const files = (e.target as HTMLInputElement).files
    if (files) {
      const formData = new FormData()
      formData.append('file', files[0])

      const response = await fetch('http://localhost:4000/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      const { data } = result
      list.value = [data]
    }
  }

  return {
    list,
    selectFile,
    handleFileChange,
    reset,
  }
}