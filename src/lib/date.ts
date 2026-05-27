export function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function fromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function getMonthDays(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const dayCount = new Date(year, month + 1, 0).getDate()

  return [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => new Date(year, month, index + 1)),
  ]
}

export function isPastDate(dateKey: string) {
  return dateKey < toDateKey(new Date())
}

export function daysBetween(startKey: string, endKey: string) {
  const start = fromDateKey(startKey)
  const end = fromDateKey(endKey)

  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}
