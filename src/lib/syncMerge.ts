import { normalizeDiarySyncData } from './diary'
import { normalizeAppData, pruneAppDataForStorage } from './tasks'
import type { AppData, DiariesByDate, DiarySyncData, TodoTask } from '../types/electron'

function getTaskTimestamp(task: TodoTask) {
  return task.deletedAt ?? task.updatedAt ?? task.createdAt
}

function isAfterOrEqual(left: string | undefined, right: string | undefined) {
  if (!left) {
    return false
  }

  if (!right) {
    return true
  }

  return Date.parse(left) >= Date.parse(right)
}

function mergeTaskList(localTasks: TodoTask[] = [], remoteTasks: TodoTask[] = []) {
  const mergedById = new Map<string, TodoTask>()

  for (const task of remoteTasks) {
    mergedById.set(task.id, task)
  }

  for (const task of localTasks) {
    const existing = mergedById.get(task.id)

    if (!existing || isAfterOrEqual(getTaskTimestamp(task), getTaskTimestamp(existing))) {
      mergedById.set(task.id, task)
    }
  }

  return [...mergedById.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function mergeAppData(localRaw: unknown, remoteRaw: unknown): AppData {
  const local = normalizeAppData(localRaw)
  const remote = normalizeAppData(remoteRaw)
  const dateKeys = new Set([
    ...Object.keys(local.tasksByDate),
    ...Object.keys(remote.tasksByDate),
  ])

  const tasksByDate = Object.fromEntries(
    [...dateKeys]
      .map((dateKey) => [
        dateKey,
        mergeTaskList(local.tasksByDate[dateKey], remote.tasksByDate[dateKey]),
      ])
      .filter(([, tasks]) => tasks.length > 0),
  )

  const recurringRulesById = new Map(remote.recurringRules.map((rule) => [rule.id, rule]))
  for (const rule of local.recurringRules) {
    const existing = recurringRulesById.get(rule.id)
    if (!existing || isAfterOrEqual(rule.updatedAt, existing.updatedAt)) {
      recurringRulesById.set(rule.id, rule)
    }
  }

  return pruneAppDataForStorage({
    tasksByDate,
    recurringRules: [...recurringRulesById.values()],
    featureSettings: {
      ...remote.featureSettings,
      ...local.featureSettings,
    },
  })
}

function getDiaryTimestamp(data: DiarySyncData, dateKey: string) {
  const updatedAt = data.updatedAtByDate[dateKey]
  const deletedAt = data.deletedAtByDate[dateKey]

  if (isAfterOrEqual(deletedAt, updatedAt)) {
    return { kind: 'deleted' as const, timestamp: deletedAt }
  }

  return { kind: 'entry' as const, timestamp: updatedAt }
}

export function mergeDiarySyncData(localRaw: unknown, remoteRaw: unknown): DiarySyncData {
  const local = normalizeDiarySyncData(localRaw)
  const remote = normalizeDiarySyncData(remoteRaw)
  const dateKeys = new Set([
    ...Object.keys(local.entries),
    ...Object.keys(local.updatedAtByDate),
    ...Object.keys(local.deletedAtByDate),
    ...Object.keys(remote.entries),
    ...Object.keys(remote.updatedAtByDate),
    ...Object.keys(remote.deletedAtByDate),
  ])
  const entries: DiariesByDate = {}
  const updatedAtByDate: Record<string, string> = {}
  const deletedAtByDate: Record<string, string> = {}

  for (const dateKey of dateKeys) {
    const localState = getDiaryTimestamp(local, dateKey)
    const remoteState = getDiaryTimestamp(remote, dateKey)
    const useLocal = isAfterOrEqual(localState.timestamp, remoteState.timestamp)
    const source = useLocal ? local : remote
    const state = useLocal ? localState : remoteState

    if (state.kind === 'deleted') {
      if (state.timestamp) {
        deletedAtByDate[dateKey] = state.timestamp
      }
      continue
    }

    if (source.entries[dateKey]) {
      entries[dateKey] = source.entries[dateKey]
      if (state.timestamp) {
        updatedAtByDate[dateKey] = state.timestamp
      }
    }
  }

  return { entries, updatedAtByDate, deletedAtByDate }
}
