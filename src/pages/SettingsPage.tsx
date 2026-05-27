import { useTodo } from '../context/TodoContext'

export function SettingsPage() {
  const { autoLaunchEnabled, handleAutoLaunchChange, error } = useTodo()

  return (
    <>
      <section className="settings-row" aria-label="Settings">
        <div>
          <strong>开机自启动</strong>
          <span>打开电脑后自动启动 Daily</span>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={autoLaunchEnabled}
            onChange={(event) => handleAutoLaunchChange(event.target.checked)}
          />
          <span />
        </label>
      </section>

      {error && <p className="error-message">{error}</p>}
    </>
  )
}
