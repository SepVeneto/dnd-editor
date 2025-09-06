<template>
  <aside
    style="width: 300px;"
  >
    <ElTabs v-if="needTabs">
      <ElTabPane label="组件">
        <el-scrollbar
          wrap-style="height: 700px;"
          noresize
        >
          <ElCollapse
            v-if="hasGroup(app.widgets)"
            :model-value="app.widgets?.map(item => item.name)"
          >
            <ElCollapseItem
              v-for="(item, index) in app.widgets"
              :key="index"
              :name="item.name"
              :title="item.name"
            >
              <VueDraggable
                v-model="item.list"
                :group="{ name: 'editor', pull: 'clone', put: false }"
                :clone="handleClone"
                :sort="false"
                item-key="name"
                class="mpd-grid mpd-gap-4"
                style="grid-template-columns: repeat(3, 90px);"
                @end="handleEnd"
              >
                <template #item="{ element }">
                  <div
                    class="mpd-flex mpd-flex-col mpd-justify-center mpd-items-center mpd-py-2 mpd-cursor-grab mpd-text-sm hover:mpd-bg-slate-100"
                    style="height: 90px;"
                  >
                    <component
                      :is="render"
                      v-if="element.icon"
                      class="mpd-size-7 mpd-mb-4"
                      scope="icons"
                      :type="element.icon"
                    />
                    <IconWidget
                      v-else
                      class="mpd-size-7 mpd-mb-4"
                    />
                    <div>{{ element.name }}</div>
                  </div>
                </template>
              </VueDraggable>
            </ElCollapseItem>
          </ElCollapse>
          <VueDraggable
            v-else
            v-model="app.widgets"
            :group="{ name: 'editor', pull: 'clone', put: false }"
            :clone="handleClone"
            :sort="false"
            item-key="name"
            class="mpd-grid mpd-gap-4"
            style="grid-template-columns: repeat(3, 90px);"
            @end="handleEnd"
          >
            <template #item="{ element }">
              <div
                class="mpd-flex mpd-flex-col mpd-justify-center mpd-items-center mpd-py-2 mpd-cursor-grab mpd-text-sm hover:mpd-bg-slate-100"
                style="height: 90px;"
              >
                <component
                  :is="render"
                  v-if="element.icon"
                  class="mpd-size-7 mpd-mb-4"
                  scope="icons"
                  :type="element.icon"
                />
                <IconWidget
                  v-else
                  class="mpd-size-7 mpd-mb-4"
                />
                <div>{{ element.name }}</div>
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
    >
      <template #header>
        <span>组件</span>
      </template>
      <el-scrollbar
        wrap-style="height: 700px;"
        noresize
      >
        <VueDraggable
          v-model="app.widgets"
          :group="{ name: 'editor', pull: 'clone', put: false }"
          :clone="handleClone"
          :sort="false"
          item-key="name"
        >
          <template #item="{ element }">
            <div>{{ element.name }}</div>
          </template>
        </VueDraggable>
      </el-scrollbar>
    </ElCard>
  </aside>
</template>

<script lang="ts" setup>
import type { WidgetGroup } from '@/store/app'
import { Node, Widget } from '@sepveneto/dnde-core/class'
import { computed, shallowRef, watchEffect } from 'vue'
import VueDraggable from 'vuedraggable'
import IconWidget from '@/assets/widget.vue'
import { useEditor } from '@/store'
import { useApp } from '@/store/app'
import { loadFromRemote } from '@/utils'

const app = useApp()
const editor = useEditor()

function hasGroup(list?: (Widget | WidgetGroup)[]): list is WidgetGroup[] {
  if (!list)
    return false

  return list.some(item => !(item instanceof Widget))
}

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
  background-color: #ffffff;
  border-right: 1px solid #ebeef5;

  .widgets-tabs {
    height: 100%;

    :deep(.el-tabs__header) {
      margin-bottom: 0;
      background: white;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

      .el-tabs__nav-wrap::after {
        background-color: #e4e7ed;
      }

      .el-tabs__item {
        color: #606266;
        transition: all 0.3s;
        position: relative;
        padding: 0 20px;

        &.is-active {
          color: #409eff;
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
      border-bottom: 1px solid #ebeef5;
      padding: 15px 20px;
    }

    .card-header {
      font-size: 16px;
      font-weight: 500;
      color: #303133;
    }
  }

  .widgets-scrollbar {
    :deep(.el-scrollbar__bar) {
      opacity: 0;
      transition: opacity 0.3s;
    }

    &:hover :deep(.el-scrollbar__bar) {
      opacity: 1;
    }
  }

  .widgets-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 12px;
  }

  .widgets-list {
    padding: 12px;
  }

  .widget-item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: white;
    border-radius: 4px;
    padding: 12px 6px;
    cursor: grab;
    transition: all 0.3s;
    border: 1px solid #ebeef5;

    &:hover {
      border-color: #409eff;
      box-shadow: 0 0 6px rgba(64, 158, 255, 0.2);
    }

    .widget-icon {
      font-size: 20px;
      margin-bottom: 6px;
      color: #606266;
    }

    .widget-name {
      font-size: 12px;
      color: #606266;
      text-align: center;
      line-height: 1.4;
    }
  }

  .widget-item-simple {
    padding: 10px 12px;
    background: white;
    border-radius: 4px;
    margin-bottom: 6px;
    cursor: grab;
    transition: all 0.2s;
    border: 1px solid #ebeef5;

    &:hover {
      border-color: #409eff;
      background: #ecf5ff;
    }
  }
}
</style>
