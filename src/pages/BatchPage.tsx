import { DEFAULT_REMINDER_TIME, WEEKDAY_OPTIONS } from '../lib/recurring'
import { useTodo } from '../context/TodoContext'

export function BatchPage() {
  const { batchTask, batchRule, toggleBatchWeekday, setBatchReminderTime, error } = useTodo()
  const selectedWeekdayCount = batchRule?.weekdays.length ?? 0
  const reminderTime = batchRule?.reminderTime ?? DEFAULT_REMINDER_TIME

  return (
    <section className="batch-panel" aria-label="批量重复设置">
      {batchTask ? (
        <>
          <ul className="batch-weekday-list">
            {WEEKDAY_OPTIONS.map((option) => {
              const checked = batchRule?.weekdays.includes(option.value) ?? false

              return (
                <li className="batch-weekday-item" key={option.value}>
                  <label>
                    <span>{option.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBatchWeekday(option.value)}
                    />
                  </label>
                </li>
              )
            })}
          </ul>

          <label className="batch-reminder-row">
            <span>
              <strong>提醒时间</strong>
              <em>
                {selectedWeekdayCount > 0
                  ? `会在选中的日期 ${reminderTime} 提醒`
                  : '先选择重复日期，再设置提醒时间'}
              </em>
            </span>
            <input
              type="time"
              value={reminderTime}
              disabled={selectedWeekdayCount === 0}
              onChange={(event) => setBatchReminderTime(event.target.value)}
            />
          </label>
        </>
      ) : (
        <p className="batch-hint">未找到对应任务，请返回后重试。</p>
      )}

      {error && <p className="error-message">{error}</p>}
    </section>
  )
}
