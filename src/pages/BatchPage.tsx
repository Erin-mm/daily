import { WEEKDAY_OPTIONS } from '../lib/recurring'
import { useTodo } from '../context/TodoContext'

export function BatchPage() {
  const { batchTask, batchRule, toggleBatchWeekday, error } = useTodo()

  return (
    <section className="batch-panel" aria-label="批量重复设置">
      {batchTask ? (
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
      ) : (
        <p className="batch-hint">未找到对应任务，请返回后重试。</p>
      )}

      {error && <p className="error-message">{error}</p>}
    </section>
  )
}
