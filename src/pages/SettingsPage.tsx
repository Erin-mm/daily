import { useTodo } from '../context/TodoContext'

export function SettingsPage() {
  const {
    autoLaunchEnabled,
    featureSettings,
    handleAutoLaunchChange,
    handleFeatureSettingChange,
    error,
  } = useTodo()

  return (
    <>
      <section className="settings-row" aria-label="功能配置">
        <div>
          <strong>日历功能</strong>
          <span>开启后可从顶部进入日历并按日期查看任务</span>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={featureSettings.calendarEnabled}
            onChange={(event) =>
              handleFeatureSettingChange('calendarEnabled', event.target.checked)
            }
          />
          <span />
        </label>
      </section>

      <section className="settings-row" aria-label="日记配置">
        <div>
          <strong>日记功能</strong>
          <span>开启后可为日期记录日记并查看日记列表</span>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={featureSettings.diaryEnabled}
            onChange={(event) => handleFeatureSettingChange('diaryEnabled', event.target.checked)}
          />
          <span />
        </label>
      </section>

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
