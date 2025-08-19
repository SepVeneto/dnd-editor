<template>
  <el-upload
    class="avatar-uploader"
    action=""
    :show-file-list="false"
    :http-request="customRequest"
  >
    <img
      v-if="imageUrl"
      :src="imageUrl"
      class="avatar"
      :style="imgStyle"
    >
    <el-icon
      v-else
      class="avatar-uploader-icon"
      :style="imgStyle"
    >
      <Plus />
    </el-icon>
  </el-upload>
</template>

<script lang="ts" setup>
import { Plus } from '@element-plus/icons-vue'
import type { PropType } from 'vue'
import { computed } from 'vue'
import type { UploadRequestOptions } from 'element-plus'
const emit = defineEmits(['update:modelValue'])
const props = defineProps({
  width: String,
  height: String,
  httpRequest: {
    type: Function as PropType<any>,
    default: undefined,
  },
  modelValue: {
    type: String,
    default: '',
  },
})
const imgStyle = computed(() => {
  return {
    width: props.width,
    height: props.height,
  }
})
const imageUrl = computed({
  get() {
    return props.modelValue
  },
  set(val) {
    emit('update:modelValue', val)
  },
})
const uploadRequest: any = window.microApp?.getData()?.upload ?? noop
function noop() {

}
async function customRequest(data: UploadRequestOptions) {
  const res = await uploadRequest(data)
  imageUrl.value = res
}
</script>

<style scoped>
.avatar-uploader .avatar {
  width: 178px;
  height: 178px;
  display: block;
  object-fit: contain;
}
</style>

<style>
.avatar-uploader .el-upload {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
}

.avatar-uploader .el-upload:hover {
  border-color: var(--el-color-primary);
}

.el-icon.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 178px;
  height: 178px;
  text-align: center;
}
</style>
