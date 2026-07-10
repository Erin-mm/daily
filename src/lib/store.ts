import { normalizeDiarySyncData } from './diary'
import type { AppData, DiariesByDate, DiarySyncData } from '../types/electron'

const TASKS_STORAGE_KEY = 'daily:tasks'
const DIARIES_STORAGE_KEY = 'daily:diaries'

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function formatStoreError(error: unknown, action: 'load' | 'save', kind: 'tasks' | 'diary') {
  const message = getErrorMessage(error)
  const label = kind === 'diary' ? '日记' : '任务'

  if (message.includes('No handler registered')) {
    return `${label}功能未加载：请完全退出应用后重新运行 npm run dev（仅刷新页面不够，需重启 Electron）。`
  }

  if (action === 'load') {
    return `${label}读取失败，请重启应用后再试。`
  }

  return `${label}保存失败：${message}`
}

function readLocalStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return fallback
  }

  return JSON.parse(raw) as T
}

function writeLocalStorageJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export async function loadTasks() {
  if (window.todoStore?.loadTasks) {
    return window.todoStore.loadTasks()
  }

  return readLocalStorageJson<Partial<AppData>>(TASKS_STORAGE_KEY, {})
}

export async function saveTasks(data: AppData) {
  if (window.todoStore?.saveTasks) {
    return window.todoStore.saveTasks(data)
  }

  writeLocalStorageJson(TASKS_STORAGE_KEY, data)
  return data
}

export async function saveDiaries(diariesByDate: DiarySyncData | DiariesByDate) {
  const normalized = normalizeDiarySyncData(diariesByDate)

  if (window.todoStore?.saveDiaries) {
    return window.todoStore.saveDiaries(normalized)
  }

  writeLocalStorageJson(DIARIES_STORAGE_KEY, normalized)
  return normalized
}

export async function loadDiaries() {
  if (window.todoStore?.loadDiaries) {
    return window.todoStore.loadDiaries()
  }

  return normalizeDiarySyncData(readLocalStorageJson<unknown>(DIARIES_STORAGE_KEY, {}))
}
