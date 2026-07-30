import ElementPlus  from 'element-plus'
import ElementPlusCss from 'element-plus/dist/index.css?inline'

export const use = [{ plugin: ElementPlus, options: {}} ]

export const styles = [ElementPlusCss.replace(':root', ':host')]
