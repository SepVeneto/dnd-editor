import type { CSSProperties, Ref } from 'vue'
import { ref, unref, watchEffect } from 'vue'
type Style = Partial<Record<keyof CSSProperties, string | number>>
export function useNormalizeStyle(
  style: Style | Ref<any>,
) {
  const _style = ref({
    transition: 'inherit',
  })
  watchEffect(() => {
    const res = Object.entries(unref(style)).reduce<Partial<CSSProperties>>(
      (obj, _style) => {
        const [key, value] = _style
        if (typeof value === 'number') {
          obj[key] = `${value}px`
        } else {
          obj[key] = value
        }
        return obj
      }, {} as Partial<CSSProperties>)
    _style.value = {
      ..._style.value,
      ...res,
    }
  })
  return _style
}
