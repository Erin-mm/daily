import type { CSSProperties } from 'react'
import { useTodo } from '../context/TodoContext'

export function TasksPage() {
  const {
    error,
    isReadOnlyDate,
    selectedTasks,
    completedCount,
    progressPercent,
    newTask,
    setNewTask,
    handleAddTask,
    toggleTask,
    deleteTask,
    openBatchView,
    hasBatchSchedule,
  } = useTodo()

  const progressStyle = { '--progress': `${progressPercent}%` } as CSSProperties &
    Record<'--progress', string>

  return (
    <>
      {!isReadOnlyDate && (
        <form className="task-form" onSubmit={handleAddTask}>
          <input
            type="text"
            value={newTask}
            placeholder="输入一个新任务..."
            onChange={(event) => setNewTask(event.target.value)}
          />
          <div
            className="progress-ring"
            aria-label={`${completedCount} / ${selectedTasks.length} 已完成`}
            style={progressStyle}
          >
            <span>进度</span>
          </div>
        </form>
      )}

      {error && <p className="error-message">{error}</p>}

      <div className={isReadOnlyDate ? 'task-list read-only' : 'task-list'}>
        {selectedTasks.length === 0 ? (
          <div className="empty-state">
            <span>{isReadOnlyDate ? '这一天没有任务' : '今天还没有任务'}</span>
            {!isReadOnlyDate && <p>写下第一件要完成的小事。</p>}
          </div>
        ) : (
          selectedTasks.map((task) => (
            <article
              className={task.completed ? 'task-item done' : 'task-item'}
              key={task.id}
            >
              <label>
                <input
                  type="checkbox"
                  checked={task.completed}
                  disabled={isReadOnlyDate}
                  onChange={() => toggleTask(task.id)}
                />
                <span>{task.text}</span>
              </label>
              {!isReadOnlyDate && (
                <div className="task-actions">
                  <button
                    type="button"
                    className={hasBatchSchedule(task) ? 'task-batch active' : 'task-batch'}
                    aria-label={`为「${task.text}」设置批量重复`}
                    onClick={() => openBatchView(task.id)}
                  >
                    批量
                  </button>
                  {task.completed && (
                    <button
                      type="button"
                      className="task-delete"
                      aria-label={`删除「${task.text}」`}
                      onClick={() => deleteTask(task.id)}
                    >
                      <svg aria-hidden="true" viewBox="198 0 848 1040">
                        <path d="M1034.570239 270.996844V841.152359a182.847641 182.847641 0 0 1-182.847641 182.847641H391.641363a182.847641 182.847641 0 0 1-182.847641-182.847641V270.996844a45.090228 45.090228 0 0 1 0-90.162172v-0.091424h196.561214a219.837719 219.837719 0 0 1 432.672374 0h196.542929v0.109708a45.090228 45.090228 0 0 1 0 90.143888zM621.68198 90.398228a132.546255 132.546255 0 0 0-124.610667 90.34502h249.221335A132.546255 132.546255 0 0 0 621.68198 90.398228z m324.408286 180.690039H297.273695v552.858129a109.708585 109.708585 0 0 0 109.708585 109.708584h429.399401a109.708585 109.708585 0 0 0 109.708585-109.708584V271.106552z m-221.245646 481.85839a44.230844 44.230844 0 0 1-44.230845-44.230845V496.027436a44.230844 44.230844 0 0 1 88.479974 0v212.688376a44.230844 44.230844 0 0 1-44.194275 44.249129z m-206.434987 0a44.230844 44.230844 0 0 1-44.230845-44.230845V496.027436a44.230844 44.230844 0 0 1 88.479974 0v212.688376a44.230844 44.230844 0 0 1-44.194275 44.249129z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </>
  )
}
