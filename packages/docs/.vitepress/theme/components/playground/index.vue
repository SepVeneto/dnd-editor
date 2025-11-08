<template>
  <div style="margin: 0 auto; width: 500px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; margin-top: 20px;">
    <span>远程地址：</span>
    <ElInput
      v-model="_remoteUrl"
      style="width: 200px;"
    />
    <ElButton
      type="primary"
      @click="connect"
    >
      连接
    </ElButton>
    <ElButton @click="getEditorData">
      获取数据
    </ElButton>
  </div>

  <mpd-editor
    v-if="editor.render.value"
    :key="remoteUrl"
    ref="refEditor"
    :remote-url="remoteUrl"
    :widgets="widgets"
    :extra="editor.extra"
  />
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useEditor } from './composable'
import { widgets } from './widgets'

const editorRef = useTemplateRef('refEditor')
const editor = useEditor()

const remoteUrl = ref(window.localStorage.getItem('remote-url') || 'http://localhost:8090')
const _remoteUrl = ref(remoteUrl.value)

// // mockApi().then((res) => {
// //   editor.waitForMounted.then(() => {
// //     // 设置编辑器数据
// //     refEditor.value.setData(res)
// //   })
// // })

init()

function connect() {
  window.localStorage.setItem('remote-url', _remoteUrl.value)
  window.location.reload()
}
async function init() {
  await editor.register()
  // 编辑器的其它初始化逻辑
}

async function getEditorData() {
  // 校验编辑器数据是否合法
  await editorRef.value.validate()

  // 获取编辑器数据
  const data = editorRef.value.getData()
  // eslint-disable-next-line no-alert
  window.alert(JSON.stringify(data, null, 2))
}
</script>
