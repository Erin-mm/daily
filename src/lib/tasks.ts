import type { AppData, TasksByDate, TodoTask } from '../types/electron'

export function createTask(text: string, recurringRuleId?: string): TodoTask {
  return {
    id: crypto.randomUUID(),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
    ...(recurringRuleId ? { recurringRuleId } : {}),
  }
}

export function normalizeAppData(raw: unknown): AppData {
  if (raw && typeof raw === 'object' && 'tasksByDate' in raw) {
    const data = raw as AppData
    return {
      tasksByDate: data.tasksByDate ?? {},
      recurringRules: Array.isArray(data.recurringRules) ? data.recurringRules : [],
    }
  }

  if (raw && typeof raw === 'object') {
    return {
      tasksByDate: raw as TasksByDate,
      recurringRules: [],
    }
  }

  return {
    tasksByDate: {},
    recurringRules: [],
  }
}
