import type MarkdownIt from 'markdown-it'
import TableWrapper from './table-wrapper'
// @ts-expect-error: ignore
import taskList from 'markdown-it-task-lists'

export const mpPlugin = (md: MarkdownIt) => {
  md.use(TableWrapper)
  md.use(taskList)
}