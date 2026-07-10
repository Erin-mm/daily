import { useTodo } from '../context/TodoContext'

export function SettingsPage() {
  const {
    autoLaunchEnabled,
    featureSettings,
    githubSyncSettings,
    githubSyncStatus,
    handleAutoLaunchChange,
    handleFeatureSettingChange,
    handleGitHubSyncSettingChange,
    syncGitHubNow,
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

      <section className="settings-sync-panel" aria-label="GitHub 同步">
        <div className="settings-sync-header">
          <div>
            <strong>GitHub 同步</strong>
            <span>把任务和日记同步到私有仓库，手机和桌面共用同一份数据</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={githubSyncSettings.enabled}
              onChange={(event) =>
                handleGitHubSyncSettingChange('enabled', event.target.checked)
              }
            />
            <span />
          </label>
        </div>

        <div className="settings-sync-header settings-sync-header--sub">
          <div>
            <strong>自动同步</strong>
            <span>关闭时只保存本机，打开 VPN 后可手动点立即同步</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={githubSyncSettings.autoSyncEnabled}
              onChange={(event) =>
                handleGitHubSyncSettingChange('autoSyncEnabled', event.target.checked)
              }
            />
            <span />
          </label>
        </div>

        <div className="settings-sync-grid">
          <label>
            <span>Owner</span>
            <input
              type="text"
              value={githubSyncSettings.owner}
              placeholder="你的 GitHub 用户名"
              onChange={(event) => handleGitHubSyncSettingChange('owner', event.target.value)}
            />
          </label>
          <label>
            <span>Repo</span>
            <input
              type="text"
              value={githubSyncSettings.repo}
              placeholder="daily-data"
              onChange={(event) => handleGitHubSyncSettingChange('repo', event.target.value)}
            />
          </label>
          <label>
            <span>Branch</span>
            <input
              type="text"
              value={githubSyncSettings.branch}
              placeholder="main"
              onChange={(event) => handleGitHubSyncSettingChange('branch', event.target.value)}
            />
          </label>
          <label>
            <span>Path</span>
            <input
              type="text"
              value={githubSyncSettings.basePath}
              placeholder="daily-data"
              onChange={(event) => handleGitHubSyncSettingChange('basePath', event.target.value)}
            />
          </label>
          <label className="settings-sync-token">
            <span>Token</span>
            <input
              type="password"
              value={githubSyncSettings.token}
              placeholder="fine-grained token"
              onChange={(event) => handleGitHubSyncSettingChange('token', event.target.value)}
            />
          </label>
        </div>

        <div className="settings-sync-actions">
          <button type="button" onClick={() => void syncGitHubNow()}>
            立即同步
          </button>
          <p className={`settings-sync-status ${githubSyncStatus.state}`}>
            {githubSyncStatus.message}
            {githubSyncStatus.lastSyncedAt
              ? ` · ${new Date(githubSyncStatus.lastSyncedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : ''}
          </p>
        </div>
      </section>

      {error && <p className="error-message">{error}</p>}
    </>
  )
}
