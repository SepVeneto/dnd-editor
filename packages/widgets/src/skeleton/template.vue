<template>
  <div @click="choose">
    test
  </div>
</template>

<script lang="ts" setup>
import type { EditorContext } from '@sepveneto/dnde-core'
import { editorContextKey } from '@sepveneto/dnde-core'
import { inject } from 'vue'

const editor = inject<EditorContext>(editorContextKey)

function choose() {
  editor?.bus.emit('choose')
}
</script>
