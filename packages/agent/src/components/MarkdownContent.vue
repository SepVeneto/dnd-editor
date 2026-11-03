<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed } from 'vue'

const props = defineProps<{
  source: string
}>()

marked.setOptions({
  gfm: true,
  breaks: true,
})

const rendered = computed(() => {
  const html = marked.parse(props.source) as string
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  })
})
</script>

<template>
  <div
    class="markdown-content"
    v-html="rendered"
  />
</template>
