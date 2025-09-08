<script lang="ts">
import type { WidgetGroup } from '@/store/app'
import { Node, Widget } from '@sepveneto/dnde-core/class'
import { ElCard, ElCollapse, ElCollapseItem, ElScrollbar, ElTabPane, ElTabs } from 'element-plus'
import { computed, h, shallowRef, watchEffect } from 'vue'
import VueDraggable from 'vuedraggable'
import IconWidget from '@/assets/widget.vue'
import { useEditor } from '@/store'
import { useApp } from '@/store/app'
import { loadFromRemote } from '@/utils'

export default {
  setup() {
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

    const widgetRenderer = (element: any) => (
      h(
        'div',
        {
          class: 'mpd-flex mpd-flex-col mpd-justify-center mpd-items-center mpd-py-2 mpd-cursor-grab mpd-text-sm hover:mpd-bg-slate-100',
          style: 'height: 90px;',
        },
        [element.icon && render.value
          ? h(render.value, {
              class: 'mpd-size-7 mpd-mb-4',
              scope: 'icons',
              type: element.icon,
            })
          : h(IconWidget, { class: 'mpd-size-7 mpd-mb-4' }), h('div', element.name)],
      )
    )

    const singleRenderer = (inTab: boolean) => {
      const render = () => h(VueDraggable, {
        'modelValue': app.widgets,
        'group': { name: 'editor', pull: 'clone', put: false },
        'clone': handleClone,
        'sort': false,
        'itemKey': 'name',
        'class': 'mpd-grid mpd-gap-4',
        'style': 'grid-template-columns: repeat(3, 90px);',
        'onUpdate:modelValue': (val: Widget[]) => app.widgets = val,
        'onEnd': handleEnd,
      }, {
        item: ({ element }: { element: Widget }) => widgetRenderer(element),
      })

      if (inTab) {
        return render()
      }
      else {
        return h(ElCard, { shadow: 'never' }, {
          header: () => h('span', '组件'),
          default: () => h(
            ElScrollbar,
            { wrapStyle: 'height: 700px', noresize: true },
            render,
          ),
        })
      }
    }
    const groupRenderer = () => {
      const list = app.widgets as WidgetGroup[]
      return h(
        ElCollapse,
        { modelValue: list?.map(item => item.name) },
        () => list?.map(item => h(
          ElCollapseItem,
          { name: item.name, title: item.name },
          () => h(VueDraggable, {
            'modelValue': item.list,
            'group': { name: 'editor', pull: 'clone', put: false },
            'clone': handleClone,
            'sort': false,
            'itemKey': 'name',
            'class': 'mpd-grid mpd-gap-4',
            'style': 'grid-template-columns: repeat(3, 90px);',
            'onUpdate:modelValue': (val: Widget[]) => item.list = val,
            'onEnd': handleEnd,
          }, {
            item: ({ element }: { element: Widget }) => widgetRenderer(element),
          }),
        )),
      )
    }
    const tabRenderer = () => (
      h(ElTabs, () => [
        h(
          ElTabPane,
          { label: '组件' },
          () => h(
            ElScrollbar,
            { wrapStyle: 'height: 700px;', noresize: true },
            () => hasGroup(app.widgets) ? groupRenderer() : singleRenderer(true),
          ),
        ),
        editor.plugins.widget.list.map(item => h(
          ElTabPane,
          { label: item.label },
          () => h(render.value, { scope: 'skeleton', type: item.name }),
        )),
      ])
    )
    const notabRenderer = () => hasGroup(app.widgets) ? groupRenderer() : singleRenderer(false)

    return {
      app,
      needTabs,
      hasGroup,
      handleClone,
      handleEnd,
      tabRenderer,
      notabRenderer,
    }
  },
  render() {
    return h(
      'aside',
      { style: 'width: 300px' },
      this.needTabs ? this.tabRenderer() : this.notabRenderer(),
    )
  },
}
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
