import type { RecurringRule, TasksByDate, TodoTask } from '../types/electron'
import { fromDateKey } from './date'
import { createTask } from './tasks'

export const WEEKDAY_OPTIONS = [
  { label: '每周一', value: 1 },
  { label: '每周二', value: 2 },
  { label: '每周三', value: 3 },
  { label: '每周四', value: 4 },
  { label: '每周五', value: 5 },
  { label: '每周六', value: 6 },
  { label: '每周日', value: 0 },
] as const

export const RECURRING_SYNC_INTERVAL_MS = 60_000
export const DEFAULT_REMINDER_TIME = '09:00'

export function applyRecurringRulesForDate(
  tasksByDate: TasksByDate,
  rules: RecurringRule[],
  dateKey: string,
) {
  const weekday = fromDateKey(dateKey).getDay()
  const activeRules = rules.filter(
    (rule) => Array.isArray(rule.weekdays) && rule.weekdays.includes(weekday),
  )

  if (activeRules.length === 0) {
    return tasksByDate
  }

  const dayTasks = [...(tasksByDate[dateKey] ?? [])]
  let changed = false

  for (const rule of activeRules) {
    if (dayTasks.some((task) => task.recurringRuleId === rule.id)) {
      continue
    }

    dayTasks.unshift(createTask(rule.text, rule.id))
    changed = true
  }

  if (!changed) {
    return tasksByDate
  }

  return {
    ...tasksByDate,
    [dateKey]: dayTasks,
  }
}

export function getRecurringRuleForTask(task: TodoTask, rules: RecurringRule[]) {
  const byTaskId = rules.find((rule) => rule.taskId === task.id)
  if (byTaskId) {
    return byTaskId
  }

  if (task.recurringRuleId) {
    return rules.find((rule) => rule.id === task.recurringRuleId)
  }

  return undefined
}

export function hasBatchSchedule(task: TodoTask, rules: RecurringRule[]) {
  const rule = getRecurringRuleForTask(task, rules)
  return rule != null && rule.weekdays.length > 0
}
