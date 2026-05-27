import { daysBetween, fromDateKey } from './date'

const dayFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})

export const monthFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
})

export type HeaderTitle =
  | string
  | {
      primary: string
      secondary: string
    }

function formatDateWithWeekday(dateKey: string) {
  const date = fromDateKey(dateKey)
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(date)

  return `${date.getMonth() + 1}月${date.getDate()}号 ${weekday}`
}

export function formatSelectedDateTitle(dateKey: string, todayKey: string): HeaderTitle {
  if (dateKey === todayKey) {
    return '今天'
  }

  if (dateKey > todayKey) {
    return {
      primary: formatDateWithWeekday(dateKey),
      secondary: `${daysBetween(todayKey, dateKey)}天后`,
    }
  }

  return dayFormatter.format(fromDateKey(dateKey))
}
