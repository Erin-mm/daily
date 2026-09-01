export type TodoTask = {
  id: string
  text: string
  completed: boolean
  createdAt: string
  updatedAt?: string
  deletedAt?: string
  recurringRuleId?: string
}

export type TasksByDate = Record<string, TodoTask[]>

export type RecurringRule = {
  id: string
  taskId: string
  text: string
  weekdays: number[]
  reminderTime?: string
  updatedAt?: string
}

export type FeatureSettings = {
  calendarEnabled: boolean
  diaryEnabled: boolean
}

export type GitHubSyncSettings = {
  enabled: boolean
  autoSyncEnabled: boolean
  owner: string
  repo: string
  branch: string
  basePath: string
  token: string
}

export type GitHubSyncStatus = {
  state: 'idle' | 'syncing' | 'success' | 'error'
  message: string
  lastSyncedAt?: string
}

export type AppData = {
  tasksByDate: TasksByDate
  recurringRules: RecurringRule[]
  featureSettings: FeatureSettings
}

export type DiariesByDate = Record<string, string>

export type DiarySyncData = {
  entries: DiariesByDate
  updatedAtByDate: Record<string, string>
  deletedAtByDate: Record<string, string>
}

export type DailyBackup = {
  format: 'daily-backup'
  version: 1
  exportedAt: string
  tasks: AppData
  diaries: DiarySyncData
}

export type BackupDialogResult = {
  canceled: boolean
  filePath?: string
  data?: unknown
}

declare global {
  interface Window {
    todoStore?: {
      loadTasks: () => Promise<AppData>
      saveTasks: (data: AppData) => Promise<AppData>
      loadDiaries: () => Promise<DiarySyncData>
      saveDiaries: (diariesByDate: DiarySyncData | DiariesByDate) => Promise<DiarySyncData>
      exportBackup: (backup: DailyBackup) => Promise<BackupDialogResult>
      importBackup: () => Promise<BackupDialogResult>
      getAutoLaunch: () => Promise<boolean>
      setAutoLaunch: (enabled: boolean) => Promise<boolean>
      setDockBadge: (count: number) => Promise<void>
    }
  }
}
