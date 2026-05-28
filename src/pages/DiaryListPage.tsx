import { useMemo } from 'react'
import { useTodo, type DiaryListEntry } from '../context/TodoContext'
import { fromDateKey } from '../lib/date'

type DiaryEntryGroup = {
  title: string
  entries: DiaryListEntry[]
}

function formatCompactDate(dateKey: string) {
  return dateKey.replaceAll('-', '/')
}

function getDiaryGroupTitle(dateKey: string, todayKey: string) {
  const date = fromDateKey(dateKey)
  const today = fromDateKey(todayKey)
  const previous30Days = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)

  if (date >= previous30Days && date <= today) {
    return '过去30天'
  }

  if (date.getFullYear() === today.getFullYear()) {
    return `${date.getMonth() + 1}月`
  }

  return `${date.getFullYear()}年`
}

function groupDiaryEntries(entries: DiaryListEntry[], todayKey: string) {
  return entries.reduce<DiaryEntryGroup[]>((groups, entry) => {
    const title = getDiaryGroupTitle(entry.dateKey, todayKey)
    const lastGroup = groups.at(-1)

    if (lastGroup?.title === title) {
      lastGroup.entries.push(entry)
      return groups
    }

    groups.push({ title, entries: [entry] })
    return groups
  }, [])
}

export function DiaryListPage() {
  const { diaryEntries, diaryError, openDiaryDate, todayKey } = useTodo()
  const groupedEntries = useMemo(
    () => groupDiaryEntries(diaryEntries, todayKey),
    [diaryEntries, todayKey],
  )

  return (
    <section className="diary-list-panel" aria-label="所有日记">
      {groupedEntries.length > 0 ? (
        groupedEntries.map((group) => (
          <section className="diary-list-group" key={group.title} aria-label={group.title}>
            <h3>{group.title}</h3>
            <ul className="diary-list">
              {group.entries.map((entry) => (
                <li key={entry.dateKey}>
                  <button
                    className="diary-list-item"
                    type="button"
                    onClick={() => openDiaryDate(entry.dateKey)}
                  >
                    <span className="diary-list-title">{formatCompactDate(entry.dateKey)}</span>
                    <span className="diary-list-preview">{entry.content.trim()}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <div className="empty-state">
          <span>还没有日记</span>
          <p>写下一天的心情后，会出现在这里。</p>
        </div>
      )}
      {diaryError && <p className="error-message">{diaryError}</p>}
    </section>
  )
}
