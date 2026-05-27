import type { DiariesByDate } from '../types/electron'

export function normalizeDiaries(raw: unknown): DiariesByDate {
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
    const { [dateKey]: _removed, ...rest } = diariesByDate
    return rest
  }

  return {
    ...diariesByDate,
    [dateKey]: content,
  }
}
