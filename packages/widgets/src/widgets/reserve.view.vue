<template>
  <div
    :style="style"
    style="margin: 0 auto;"
    @dragover="onDragover"
  >
    <div
      v-if="config.defaultImg"
      style="position: relative;"
    >
      <el-image
        style="width: 100%; height: 100%;"
        :src="config.defaultImg"
      />
      <widget-wrapper
        v-model:custom-style="titleStyle"
        class="title"
        move
        scale
      >
        <div>{{ config.title.content }}</div>
      </widget-wrapper>
      <widget-wrapper
        v-model:custom-style="descStyle"
        class="title"
        move
        scale
      >
        <div>{{ config.desc.content }}</div>
      </widget-wrapper>
    </div>
    <div
      v-else
      style="width: 100%; height: 100%;"
    >
      empty
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useNormalizeStyle, useState } from '@/hooks'
import widgetWrapper from '@/components/widgetWrapper.vue'
// import { computed, watchEffect, ref, customRef } from 'vue';
// const emit = defineEmits(['update:config'])
const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },
})

const titleStyle = useState(props.config.title, 'style')
const descStyle = useState(props.config.desc, 'style')
const style = useNormalizeStyle(props.config.style)
const wrapTitleStyle = useNormalizeStyle(titleStyle)
const wrapDescStyle = useNormalizeStyle(descStyle)
function onDragover(evt: DragEvent) {
  evt.preventDefault()
}
</script>

<style lang="scss" scoped>
.reserve_con {
	position: absolute;
	width: 40%;
	height: 100%;
	top: 0;
	right: 0;
	.text_side{
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		.desc{
			font-size: 13px;
			color: #848484;
		}
	}

}
.title{
	// line-height: 1.5;
  top: 0;
  left: 0;
}
</style>
