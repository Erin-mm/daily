export type TodoTask = {
  id: string
  text: string
  completed: boolean
  createdAt: string
  recurringRuleId?: string
}

export type TasksByDate = Record<string, TodoTask[]>

export type RecurringRule = {
  id: string
  taskId: string
  text: string
  weekdays: number[]
}

export type AppData = {
  tasksByDate: TasksByDate
  recurringRules: RecurringRule[]
}

export type DiariesByDate = Record<string, string>

declare global {
  interface Window {
    todoStore?: {
      loadTasks: () => Promise<AppData>
      saveTasks: (data: AppData) => Promise<AppData>
      loadDiaries: () => Promise<DiariesByDate>
      saveDiaries: (diariesByDate: DiariesByDate) => Promise<DiariesByDate>
      getAutoLaunch: () => Promise<boolean>
      setAutoLaunch: (enabled: boolean) => Promise<boolean>
    }
  }
}
