<template>
  <aside class="widgets-menu">
    <ElTabs
      v-if="needTabs"
      class="widgets-tabs"
    >
      <ElTabPane label="组件">
        <el-scrollbar
          wrap-class="widgets-scrollbar"
          wrap-style="max-height: calc(100vh - 120px);"
          noresize
        >
          <VueDraggable
            v-model="app.widgets"
            :group="{ name: 'editor', pull: 'clone', put: false }"
            :clone="handleClone"
            :sort="false"
            item-key="name"
            class="widgets-grid"
            @end="handleEnd"
          >
            <template #item="{ element }">
              <div
                class="widget-item"
              >
                <component
                  :is="render"
                  scope="icons"
                  :type="element.icon"
                  class="widget-icon"
                />
                <div class="widget-name">
                  {{ element.name }}
                </div>
              </div>
            </template>
          </VueDraggable>
        </el-scrollbar>
      </ElTabPane>
      <ElTabPane
        v-for="item in editor.plugins.widget.list"
        :key="item.name"
        :label="item.label"
      >
        <component
          :is="render"
          scope="skeleton"
          :type="item.name"
        />
      </ElTabPane>
    </ElTabs>
    <ElCard
      v-else
      shadow="never"
      class="widgets-card"
    >
      <template #header>
        <span class="card-header">组件</span>
      </template>
      <el-scrollbar
        wrap-class="widgets-scrollbar"
        wrap-style="max-height: calc(100vh - 120px);"
        noresize
      >
        <VueDraggable
          v-model="app.widgets"
          :group="{ name: 'editor', pull: 'clone', put: false }"
          :clone="handleClone"
          :sort="false"
          item-key="name"
          class="widgets-list"
        >
          <template #item="{ element }">
            <div class="widget-item-simple">
              {{ element.name }}
            </div>
          </template>
        </VueDraggable>
      </el-scrollbar>
    </ElCard>
  </aside>
</template>

<script lang="ts" setup>
import type { Widget } from '@sepveneto/dnde-core/class'
import { Node } from '@sepveneto/dnde-core/class'
import { computed, shallowRef, watchEffect } from 'vue'
import VueDraggable from 'vuedraggable'
import { useEditor } from '@/store'
import { useApp } from '@/store/app'
import { loadFromRemote } from '@/utils'

const app = useApp()
const editor = useEditor()

function handleClone(original: Widget) {
  const node = new Node(original)
  editor.dragging = node
  return node
}
function handleEnd() {
  editor.dragging = null
}

const render = shallowRef()

const needTabs = computed(() => {
  return editor.plugins.widget.list.length > 0
})

watchEffect(() => {
  if (needTabs.value) {
    render.value = loadFromRemote('widgets', 'remote')
  }
})
</script>

<style lang="scss" scoped>
.widgets-menu {
  width: 300px;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
  border-right: 1px solid #e0e6ed;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);

  .widgets-tabs {
    height: 100%;

    :deep(.el-tabs__header) {
      margin-bottom: 0;
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      z-index: 10;

      .el-tabs__nav-wrap::after {
        background-color: transparent;
      }

      .el-tabs__item {
        font-weight: 500;
        color: #606266;
        transition: all 0.3s;
        position: relative;
        padding: 0 24px;

        &.is-active {
          color: #409eff;
          font-weight: 600;
        }
      }
    }

    :deep(.el-tabs__content) {
      flex: 1;
      overflow: hidden;
    }
  }

  .widgets-card {
    height: 100%;
    border: none;
    background: transparent;

    :deep(.el-card__header) {
      background: white;
      border-bottom: 1px solid #e0e6ed;
      padding: 12px 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
    }

    .card-header {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .widgets-scrollbar {
    :deep(.el-scrollbar__bar) {
      opacity: 0.7;
      transition: opacity 0.3s;
    }

    &:hover :deep(.el-scrollbar__bar) {
      opacity: 1;
    }
  }

  .widgets-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 16px;
  }

  .widgets-list {
    padding: 16px;
  }

  .widget-item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: white;
    border-radius: 8px;
    padding: 16px 8px;
    cursor: grab;
    transition: all 0.3s ease;
    border: 1px solid #ebeef5;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
      border-color: #c6e2ff;
      background: #f0f8ff;
    }

    .widget-icon {
      font-size: 24px;
      margin-bottom: 8px;
      color: #409eff;
    }

    .widget-name {
      font-size: 12px;
      color: #606266;
      text-align: center;
      line-height: 1.4;
    }
  }

  .widget-item-simple {
    padding: 12px 16px;
    background: white;
    border-radius: 6px;
    margin-bottom: 8px;
    cursor: grab;
    transition: all 0.2s;
    border: 1px solid #ebeef5;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

    &:hover {
      background: #f0f8ff;
      border-color: #c6e2ff;
      transform: translateX(4px);
    }
  }
}
</style>
