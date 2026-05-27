import { useTodo } from '../context/TodoContext'

export function AppHeader() {
  const {
    headerTitle,
    showTodayShortcut,
    currentView,
    goToToday,
    goToCalendar,
    goToDiary,
    goToSettings,
    goBack,
    hasTodayDiary,
    selectedDate,
    todayKey,
  } = useTodo()

  const showDiaryButton = selectedDate <= todayKey

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Daily</p>
        <h2>
          {typeof headerTitle === 'string' ? (
            headerTitle
          ) : (
            <>
              {headerTitle.primary}
              <span className="header-date-offset">{headerTitle.secondary}</span>
            </>
          )}
        </h2>
      </div>

      <div className="header-actions">
        {showTodayShortcut && (
          <button className="today-shortcut" type="button" onClick={goToToday}>
            今天
          </button>
        )}
        {currentView === 'tasks' ? (
          <>
            <button
              className="icon-button"
              type="button"
              aria-label="打开日历"
              onClick={goToCalendar}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M7 3v3M17 3v3M4.5 9h15M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" />
                <path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" />
              </svg>
            </button>
            {showDiaryButton && (
              <button
                className={
                  hasTodayDiary ? 'icon-button icon-button--diary-filled' : 'icon-button'
                }
                type="button"
                aria-label="打开日记"
                onClick={goToDiary}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
                </svg>
              </button>
            )}
            <button
              className="icon-button"
              type="button"
              aria-label="打开设置"
              onClick={goToSettings}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.1 2.1 0 0 1-2.97 2.97l-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.65V21a2.1 2.1 0 0 1-4.2 0v-.07a1.8 1.8 0 0 0-1.09-1.65 1.8 1.8 0 0 0-1.98.36l-.05.05a2.1 2.1 0 0 1-2.97-2.97l.05-.05A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.65-1.09H3a2.1 2.1 0 0 1 0-4.2h.07A1.8 1.8 0 0 0 4.72 8.6a1.8 1.8 0 0 0-.36-1.98l-.05-.05A2.1 2.1 0 0 1 7.28 3.6l.05.05A1.8 1.8 0 0 0 9.31 4a1.8 1.8 0 0 0 1.09-1.65V2.3a2.1 2.1 0 0 1 4.2 0v.07A1.8 1.8 0 0 0 15.69 4a1.8 1.8 0 0 0 1.98-.36l.05-.05a2.1 2.1 0 0 1 2.97 2.97l-.05.05a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.09H22a2.1 2.1 0 0 1 0 4.2h-.07A1.8 1.8 0 0 0 19.4 15Z" />
              </svg>
            </button>
          </>
        ) : (
          <button
            className="icon-button"
            type="button"
            aria-label="返回任务"
            onClick={goBack}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}
