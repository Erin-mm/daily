import type { DiariesByDate, DiarySyncData } from '../types/electron'

export function normalizeDiaries(raw: unknown): DiariesByDate {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'entries' in raw) {
    return normalizeDiaries((raw as Partial<DiarySyncData>).entries)
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(raw).filter(
      ([dateKey, content]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof content === 'string',
    ),
  )
}

function normalizeTimestampMap(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(raw).filter(
      ([dateKey, timestamp]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(dateKey) &&
        typeof timestamp === 'string' &&
        !Number.isNaN(Date.parse(timestamp)),
    ),
  )
}

export function normalizeDiarySyncData(raw: unknown): DiarySyncData {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'entries' in raw) {
    const data = raw as Partial<DiarySyncData>

    return {
      entries: normalizeDiaries(data.entries),
      updatedAtByDate: normalizeTimestampMap(data.updatedAtByDate),
      deletedAtByDate: normalizeTimestampMap(data.deletedAtByDate),
    }
  }

  const entries = normalizeDiaries(raw)
  const now = new Date().toISOString()

  return {
    entries,
    updatedAtByDate: Object.fromEntries(Object.keys(entries).map((dateKey) => [dateKey, now])),
    deletedAtByDate: {},
  }
}

export function hasDiaryContent(content: string | undefined) {
  return Boolean(content?.trim())
}

export function withDiaryEntry(
  diariesByDate: DiariesByDate,
  dateKey: string,
  content: string,
): DiariesByDate {
  const trimmed = content.trim()

  if (!trimmed) {
    const rest = { ...diariesByDate }
    delete rest[dateKey]
    return rest
  }

  return {
    ...diariesByDate,
    [dateKey]: content,
  }
}
