import { monthFormatter } from '../lib/format'
import { toDateKey } from '../lib/date'
import { useTodo } from '../context/TodoContext'

export function CalendarPage() {
  const {
    calendarMonth,
    monthDays,
    selectedDate,
    todayKey,
    moveMonth,
    selectDate,
    getCalendarDayIndicator,
  } = useTodo()

  return (
    <section className="calendar-panel" aria-label="Calendar">
      <div className="calendar-header">
        <button type="button" onClick={() => moveMonth(-1)}>
          上月
        </button>
        <strong>{monthFormatter.format(calendarMonth)}</strong>
        <button type="button" onClick={() => moveMonth(1)}>
          下月
        </button>
      </div>

      <div className="calendar-matrix">
        <div className="weekday-row" aria-hidden="true">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {monthDays.map((date, index) => {
            if (!date) {
              return <span className="calendar-empty" key={`empty-${index}`} />
            }

            const dateKey = toDateKey(date)
            const isSelected = dateKey === selectedDate
            const isToday = dateKey === todayKey
            const dayIndicator = getCalendarDayIndicator(dateKey)
            const dayClass = [
              'calendar-day',
              isToday && 'today',
              isSelected && 'selected',
              dayIndicator && `has-indicator-${dayIndicator}`,
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <button
                className={dayClass}
                type="button"
                key={dateKey}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => selectDate(date)}
              >
                <span
                  className={[
                    'calendar-day-num',
                    dayIndicator && `calendar-day-num--${dayIndicator}`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {date.getDate()}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
