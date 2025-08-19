<template>
  <div @click="choose">
    test
  </div>
</template>

<script lang="ts" setup>
import { inject } from 'vue'
import { editorContextKey } from '@sepveneto/dnde-core'
import type { EditorContext } from '@sepveneto/dnde-core'

const editor = inject<EditorContext>(editorContextKey)

function choose() {
  editor?.bus.emit('choose')
}
</script>
