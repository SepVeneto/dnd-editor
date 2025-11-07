<template>
  <div style="margin: 0 auto; width: 400px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center;">
    <span>远程地址：</span>
    <ElInput
      v-model="_remoteUrl"
      style="width: 200px;"
    />
    <ElButton
      type="primary"
      @click="remoteUrl = _remoteUrl"
    >连接</ElButton>
  </div>

  <mpd-editor
    v-if="editor.render.value"
    ref="editor"
    :remote-url="remoteUrl"
    :widgets="widgets"
    :extra="editor.extra"
  />
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useEditor } from './composable'
import { widgets } from './widgets'

const editorRef = useTemplateRef('editor')
const editor = useEditor()

const remoteUrl = ref('http://localhost:8090')
const _remoteUrl = ref(remoteUrl.value)

// // mockApi().then((res) => {
// //   editor.waitForMounted.then(() => {
// //     // 设置编辑器数据
// //     refEditor.value.setData(res)
// //   })
// // })

init()

async function init() {
  await editor.register()
  // 编辑器的其它初始化逻辑
}

// async function getEditorData() {
//   // 校验编辑器数据是否合法
//   await editorRef.value.validate()

//   // 获取编辑器数据
//   return editorRef.value.getData()
// }
</script>
