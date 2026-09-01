import type { AppData, FeatureSettings, TasksByDate, TodoTask } from '../types/electron'
import { toDateKey } from './date'

export const DEFAULT_FEATURE_SETTINGS: FeatureSettings = {
  calendarEnabled: false,
  diaryEnabled: false,
}

export function createTask(text: string, recurringRuleId?: string): TodoTask {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    text,
    completed: false,
    createdAt: now,
    updatedAt: now,
    ...(recurringRuleId ? { recurringRuleId } : {}),
  }
}

export function normalizeAppData(raw: unknown): AppData {
  if (raw && typeof raw === 'object' && 'tasksByDate' in raw) {
    const data = raw as AppData
    return {
      tasksByDate: data.tasksByDate ?? {},
      recurringRules: Array.isArray(data.recurringRules) ? data.recurringRules : [],
      featureSettings: normalizeFeatureSettings(data.featureSettings),
    }
  }

  if (raw && typeof raw === 'object') {
    return {
      tasksByDate: raw as TasksByDate,
      recurringRules: [],
      featureSettings: DEFAULT_FEATURE_SETTINGS,
    }
  }

  return {
    tasksByDate: {},
    recurringRules: [],
    featureSettings: DEFAULT_FEATURE_SETTINGS,
  }
}

export function pruneExpiredRecurringTasks(
  tasksByDate: TasksByDate,
  todayKey = toDateKey(new Date()),
) {
  return Object.fromEntries(
    Object.entries(tasksByDate)
      .map(([dateKey, tasks]) => [
        dateKey,
        dateKey < todayKey ? tasks.filter((task) => !task.recurringRuleId) : tasks,
      ])
      .filter(([, tasks]) => tasks.length > 0),
  )
}

export function rollOverIncompleteTasks(
  tasksByDate: TasksByDate,
  todayKey = toDateKey(new Date()),
) {
  const pastDateKeys = Object.keys(tasksByDate)
    .filter((dateKey) => dateKey < todayKey)
    .sort()

  if (pastDateKeys.length === 0) {
    return tasksByDate
  }

  const nextTasksByDate: TasksByDate = { ...tasksByDate }
  const todayTasks = [...(nextTasksByDate[todayKey] ?? [])]
  const todayTaskIds = new Set(todayTasks.map((task) => task.id))
  let changed = false

  for (const dateKey of pastDateKeys) {
    const dayTasks = nextTasksByDate[dateKey] ?? []
    const remainingTasks: TodoTask[] = []

    for (const task of dayTasks) {
      const shouldRollOver = !task.completed && !task.deletedAt && !task.recurringRuleId

      if (!shouldRollOver) {
        remainingTasks.push(task)
        continue
      }

      changed = true
      if (!todayTaskIds.has(task.id)) {
        todayTasks.push(task)
        todayTaskIds.add(task.id)
      }
    }

    if (remainingTasks.length > 0) {
      nextTasksByDate[dateKey] = remainingTasks
    } else {
      delete nextTasksByDate[dateKey]
    }
  }

  if (!changed) {
    return tasksByDate
  }

  nextTasksByDate[todayKey] = todayTasks
  return nextTasksByDate
}

export function pruneAppDataForStorage(data: AppData) {
  return {
    ...data,
    tasksByDate: pruneExpiredRecurringTasks(data.tasksByDate),
  }
}

function normalizeFeatureSettings(raw: unknown): FeatureSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_FEATURE_SETTINGS
  }

  const settings = raw as Partial<FeatureSettings>

  return {
    calendarEnabled:
      typeof settings.calendarEnabled === 'boolean'
        ? settings.calendarEnabled
        : DEFAULT_FEATURE_SETTINGS.calendarEnabled,
    diaryEnabled:
      typeof settings.diaryEnabled === 'boolean'
        ? settings.diaryEnabled
        : DEFAULT_FEATURE_SETTINGS.diaryEnabled,
  }
}
