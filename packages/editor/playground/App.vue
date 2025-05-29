<template>
  <mpd-editor
    remote-url="http://localhost:8090"
    :widgets="widgets"
  />
</template>

<script setup lang="ts">
import type { IWidget } from '@sepveneto/dnde-core'
import { register } from '@/main'

register()

const widgets: IWidget<object>[] = [
  { _name: '菜单', _view: 'menuItem', _schema: 'menuItem', isShow: 0, style: {} },
]
</script>
