function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function formatStoreError(error: unknown, action: 'load' | 'save', kind: 'tasks' | 'diary') {
  const message = getErrorMessage(error)
  const label = kind === 'diary' ? '日记' : '任务'

  if (message.includes('No handler registered')) {
    return `${label}功能未加载：请完全退出应用后重新运行 npm run dev（仅刷新页面不够，需重启 Electron）。`
  }

  if (action === 'load') {
    return `${label}读取失败，请重启应用后再试。`
  }

  return `${label}保存失败：${message}`
}

export async function saveDiaries(diariesByDate: Record<string, string>) {
  if (!window.todoStore?.saveDiaries) {
    throw new Error('No handler registered for diary:save')
  }

  return window.todoStore.saveDiaries(diariesByDate)
}

export async function loadDiaries() {
  if (!window.todoStore?.loadDiaries) {
    throw new Error('No handler registered for diary:load')
  }

  return window.todoStore.loadDiaries()
}
