/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { hasDiaryContent, normalizeDiarySyncData } from '../lib/diary'
import {
  hasGitHubSyncCredentials,
  loadGitHubSyncSettings,
  normalizeGitHubSyncSettings,
  pullGitHubData,
  pushGitHubData,
  saveGitHubSyncSettings,
} from '../lib/githubSync'
import { formatStoreError, loadDiaries, loadTasks, saveDiaries, saveTasks } from '../lib/store'
import { mergeAppData, mergeDiarySyncData } from '../lib/syncMerge'
import { formatSelectedDateTitle, type HeaderTitle } from '../lib/format'
import { fromDateKey, getMonthDays, isPastDate, toDateKey } from '../lib/date'
import {
  applyRecurringRulesForDate,
  DEFAULT_REMINDER_TIME,
  getRecurringRuleForTask,
  RECURRING_SYNC_INTERVAL_MS,
} from '../lib/recurring'
import {
  createTask,
  DEFAULT_FEATURE_SETTINGS,
  normalizeAppData,
  pruneAppDataForStorage,
  pruneExpiredRecurringTasks,
} from '../lib/tasks'
import type {
  AppData,
  DiarySyncData,
  FeatureSettings,
  GitHubSyncSettings,
  GitHubSyncStatus,
  RecurringRule,
  TasksByDate,
  TodoTask,
} from '../types/electron'

const DIARY_SAVE_DEBOUNCE_MS = 350
const GITHUB_SYNC_DEBOUNCE_MS = 5000

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export type AppView = 'tasks' | 'calendar' | 'diary' | 'diaryList' | 'settings' | 'batch'

export type DiaryListEntry = {
  dateKey: string
  content: string
}

type NavigationSnapshot = {
  currentView: AppView
  selectedDate: string
  calendarMonth: Date
  batchTaskId: string | null
}

type TodoContextValue = {
  currentView: AppView
  error: string
  todayKey: string
  selectedDate: string
  selectedTasks: TodoTask[]
  isReadOnlyDate: boolean
  batchTask: TodoTask | null
  batchRule: RecurringRule | null
  headerTitle: HeaderTitle
  completedCount: number
  progressPercent: number
  monthDays: (Date | null)[]
  calendarMonth: Date
  tasksByDate: TasksByDate
  recurringRules: RecurringRule[]
  newTask: string
  autoLaunchEnabled: boolean
  featureSettings: FeatureSettings
  githubSyncSettings: GitHubSyncSettings
  githubSyncStatus: GitHubSyncStatus
  setNewTask: (value: string) => void
  goToTasks: () => void
  goToCalendar: () => void
  goToDiary: () => void
  goToSettings: () => void
  selectedDiary: string
  diaryEntries: DiaryListEntry[]
  updateDiary: (content: string) => void
  hasSelectedDiary: boolean
  isDiaryReadOnly: boolean
  diaryError: string
  goBack: () => void
  goToToday: () => void
  openDiaryList: () => void
  openDiaryDate: (dateKey: string) => void
  openBatchView: (taskId: string) => void
  selectDate: (date: Date) => void
  moveMonth: (step: number) => void
  getCalendarDayIndicator: (dateKey: string) => 'complete' | 'future' | null
  handleAddTask: (event: FormEvent<HTMLFormElement>) => void
  toggleTask: (taskId: string) => void
  deleteTask: (taskId: string) => void
  toggleBatchWeekday: (weekday: number) => void
  setBatchReminderTime: (time: string) => void
  handleAutoLaunchChange: (enabled: boolean) => void
  handleFeatureSettingChange: (setting: keyof FeatureSettings, enabled: boolean) => void
  handleGitHubSyncSettingChange: (
    setting: keyof GitHubSyncSettings,
    value: string | boolean,
  ) => void
  syncGitHubNow: () => Promise<void>
  hasBatchSchedule: (task: TodoTask) => boolean
}

const TodoContext = createContext<TodoContextValue | null>(null)
const EMPTY_TASKS: TodoTask[] = []

export function TodoProvider({ children }: { children: ReactNode }) {
  const [tasksByDate, setTasksByDate] = useState<TasksByDate>({})
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([])
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [calendarMonth, setCalendarMonth] = useState(() => fromDateKey(toDateKey(new Date())))
  const [newTask, setNewTask] = useState('')
  const [currentView, setCurrentView] = useState<AppView>('tasks')
  const [batchTaskId, setBatchTaskId] = useState<string | null>(null)
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false)
  const [featureSettings, setFeatureSettings] = useState<FeatureSettings>(DEFAULT_FEATURE_SETTINGS)
  const [githubSyncSettings, setGitHubSyncSettings] = useState<GitHubSyncSettings>(() =>
    loadGitHubSyncSettings(),
  )
  const [githubSyncStatus, setGitHubSyncStatus] = useState<GitHubSyncStatus>({
    state: 'idle',
    message: '未开启同步',
  })
  const [githubSyncRetryTick, setGitHubSyncRetryTick] = useState(0)
  const [diarySyncData, setDiarySyncData] = useState<DiarySyncData>(() =>
    normalizeDiarySyncData(null),
  )
  const [isLoaded, setIsLoaded] = useState(false)
  const [isDiaryLoaded, setIsDiaryLoaded] = useState(false)
  const [error, setError] = useState('')
  const [diaryError, setDiaryError] = useState('')
  const navigationHistoryRef = useRef<NavigationSnapshot[]>([])
  const skipDiarySaveRef = useRef(true)
  const skipNextAutoSyncRef = useRef(false)
  const isGitHubSyncingRef = useRef(false)
  const hasQueuedGitHubSyncRef = useRef(false)

  const todayKey = toDateKey(new Date())
  const selectedTasks = (tasksByDate[selectedDate] ?? EMPTY_TASKS).filter((task) => !task.deletedAt)
  const isReadOnlyDate = isPastDate(selectedDate)
  const batchTask = useMemo(
    () => selectedTasks.find((task) => task.id === batchTaskId) ?? null,
    [batchTaskId, selectedTasks],
  )
  const batchRule = useMemo(
    () => (batchTask ? getRecurringRuleForTask(batchTask, recurringRules) : undefined) ?? null,
    [batchTask, recurringRules],
  )
  const diariesByDate = diarySyncData.entries
  const selectedDiary = diariesByDate[selectedDate] ?? ''
  const diaryEntries = useMemo<DiaryListEntry[]>(
    () =>
      Object.entries(diariesByDate)
        .filter(([, content]) => hasDiaryContent(content))
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
        .map(([dateKey, content]) => ({ dateKey, content })),
    [diariesByDate],
  )
  const hasSelectedDiary = hasDiaryContent(diariesByDate[selectedDate])
  const isDiaryReadOnly = selectedDate > todayKey
  const headerTitle = useMemo(() => {
    if (currentView === 'settings') {
      return '设置'
    }

    if (currentView === 'calendar') {
      return '日历'
    }

    if (currentView === 'diary') {
      if (selectedDate === todayKey) {
        return '日记'
      }

      return formatSelectedDateTitle(selectedDate, todayKey)
    }

    if (currentView === 'diaryList') {
      return '日记列表'
    }

    if (currentView === 'batch') {
      return batchTask?.text ?? '批量重复'
    }

    return formatSelectedDateTitle(selectedDate, todayKey)
  }, [batchTask, currentView, selectedDate, todayKey])
  const completedCount = selectedTasks.filter((task) => task.completed).length
  const progressPercent = selectedTasks.length
    ? Math.round((completedCount / selectedTasks.length) * 100)
    : 0
  const monthDays = useMemo(() => getMonthDays(calendarMonth), [calendarMonth])

  useEffect(() => {
    let isMounted = true

    async function initializeData() {
      try {
        const syncSettings = loadGitHubSyncSettings()
        const [storedTasks, autoLaunch] = await Promise.all([
          loadTasks(),
          window.todoStore?.getAutoLaunch(),
        ])
        const storedDiaries = normalizeDiarySyncData(await loadDiaries())

        let nextTasks = normalizeAppData(storedTasks)
        let nextDiarySync = storedDiaries
        let nextSyncStatus: GitHubSyncStatus = syncSettings.enabled
          ? { state: 'idle', message: '等待同步' }
          : { state: 'idle', message: '未开启同步' }

        if (hasGitHubSyncCredentials(syncSettings)) {
          try {
            nextSyncStatus = { state: 'syncing', message: '正在从 GitHub 拉取' }
            if (isMounted) {
              setGitHubSyncStatus(nextSyncStatus)
            }

            const remoteData = await pullGitHubData(syncSettings)

            nextTasks = mergeAppData(nextTasks, remoteData.tasks)
            nextDiarySync = mergeDiarySyncData(nextDiarySync, remoteData.diaries)

            await Promise.all([
              saveTasks(pruneAppDataForStorage(nextTasks)),
              saveDiaries(nextDiarySync),
            ])
            await pushGitHubData(syncSettings, {
              tasks: pruneAppDataForStorage(nextTasks),
              diaries: nextDiarySync,
            })
            nextSyncStatus = {
              state: 'success',
              message: '已合并 GitHub 同步',
              lastSyncedAt: new Date().toISOString(),
            }
            skipNextAutoSyncRef.current = true
          } catch (syncError) {
            console.error(syncError)
            nextSyncStatus = {
              state: 'error',
              message: `GitHub 拉取失败：${getErrorMessage(syncError)}`,
            }
          }
        }

        if (isMounted) {
          setGitHubSyncSettings(syncSettings)
          setGitHubSyncStatus(nextSyncStatus)
          setRecurringRules(nextTasks.recurringRules)
          setFeatureSettings(nextTasks.featureSettings)
          setTasksByDate(
            applyRecurringRulesForDate(
              pruneExpiredRecurringTasks(nextTasks.tasksByDate),
              nextTasks.recurringRules,
              toDateKey(new Date()),
            ),
          )
          setDiarySyncData(nextDiarySync)
          setDiaryError('')

          if (typeof autoLaunch === 'boolean') {
            setAutoLaunchEnabled(autoLaunch)
          }
        }
      } catch (loadError) {
        console.error(loadError)
        setError(formatStoreError(loadError, 'load', 'tasks'))
      } finally {
        if (isMounted) {
          setIsLoaded(true)
          setIsDiaryLoaded(true)
        }
      }
    }

    initializeData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    async function persistTasks() {
      try {
        const payload = pruneAppDataForStorage({ tasksByDate, recurringRules, featureSettings })
        await saveTasks(payload)
        setError('')
      } catch (saveError) {
        console.error(saveError)
        setError(formatStoreError(saveError, 'save', 'tasks'))
      }
    }

    persistTasks()
  }, [featureSettings, isLoaded, recurringRules, tasksByDate])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    const todayTasks = tasksByDate[todayKey] ?? EMPTY_TASKS
    const pendingCount = todayTasks.filter((task) => !task.completed).length

    void window.todoStore?.setDockBadge(pendingCount)
  }, [isLoaded, tasksByDate, todayKey])

  useEffect(() => {
    if (!isLoaded || recurringRules.length === 0) {
      return
    }

    function syncTodayRecurringTasks() {
      const today = toDateKey(new Date())
      setTasksByDate((current) => applyRecurringRulesForDate(current, recurringRules, today))
    }

    syncTodayRecurringTasks()
    const timer = window.setInterval(syncTodayRecurringTasks, RECURRING_SYNC_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [isLoaded, recurringRules])

  useEffect(() => {
    if (!isDiaryLoaded) {
      return
    }

    if (skipDiarySaveRef.current) {
      skipDiarySaveRef.current = false
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        await saveDiaries(diarySyncData)
        setDiaryError('')
      } catch (saveError) {
        console.error(saveError)
        setDiaryError(formatStoreError(saveError, 'save', 'diary'))
      }
    }, DIARY_SAVE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [diarySyncData, isDiaryLoaded])

  const pushCurrentDataToGitHub = useCallback(
    async (statusMessage: string) => {
      if (isGitHubSyncingRef.current) {
        hasQueuedGitHubSyncRef.current = true
        setGitHubSyncStatus((status) => ({
          ...status,
          state: 'syncing',
          message: '当前同步完成后会继续同步',
        }))
        window.setTimeout(() => {
          setGitHubSyncRetryTick((tick) => tick + 1)
        }, GITHUB_SYNC_DEBOUNCE_MS)
        return
      }

      isGitHubSyncingRef.current = true

      try {
        hasQueuedGitHubSyncRef.current = false
        setGitHubSyncStatus((status) => ({
          ...status,
          state: 'syncing',
          message: statusMessage,
        }))
        await pushGitHubData(githubSyncSettings, {
          tasks: pruneAppDataForStorage({ tasksByDate, recurringRules, featureSettings }),
          diaries: diarySyncData,
        })

        setGitHubSyncStatus({
          state: 'success',
          message: hasQueuedGitHubSyncRef.current ? '还有新内容等待同步' : '已自动同步到 GitHub',
          lastSyncedAt: new Date().toISOString(),
        })
      } catch (syncError) {
        console.error(syncError)
        setGitHubSyncStatus({
          state: 'error',
          message: `GitHub 同步失败：${getErrorMessage(syncError)}`,
        })
      } finally {
        isGitHubSyncingRef.current = false
      }
    },
    [diarySyncData, featureSettings, githubSyncSettings, recurringRules, tasksByDate],
  )

  useEffect(() => {
    if (
      !isLoaded ||
      !isDiaryLoaded ||
      !githubSyncSettings.autoSyncEnabled ||
      !hasGitHubSyncCredentials(githubSyncSettings)
    ) {
      return
    }

    if (skipNextAutoSyncRef.current) {
      skipNextAutoSyncRef.current = false
      return
    }

    setGitHubSyncStatus((status) =>
      status.state === 'syncing'
        ? status
        : { ...status, state: 'idle', message: '等待停笔后自动同步' },
    )

    const timer = window.setTimeout(async () => {
      await pushCurrentDataToGitHub('正在自动同步到 GitHub')
    }, GITHUB_SYNC_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    diarySyncData,
    featureSettings,
    githubSyncSettings,
    githubSyncRetryTick,
    isDiaryLoaded,
    isLoaded,
    pushCurrentDataToGitHub,
  ])

  const updateDiary = useCallback(
    (content: string) => {
      if (selectedDate > todayKey) {
        return
      }

      const now = new Date().toISOString()
      setDiarySyncData((current) => {
        const entries = { ...current.entries }
        const updatedAtByDate = { ...current.updatedAtByDate }
        const deletedAtByDate = { ...current.deletedAtByDate }

        if (!content.trim()) {
          delete entries[selectedDate]
          delete updatedAtByDate[selectedDate]
          deletedAtByDate[selectedDate] = now
          return { entries, updatedAtByDate, deletedAtByDate }
        }

        entries[selectedDate] = content
        updatedAtByDate[selectedDate] = now
        delete deletedAtByDate[selectedDate]

        return { entries, updatedAtByDate, deletedAtByDate }
      })
    },
    [selectedDate, todayKey],
  )

  const updateSelectedTasks = useCallback(
    (updater: (tasks: TodoTask[]) => TodoTask[]) => {
      setTasksByDate((current) => ({
        ...current,
        [selectedDate]: updater(current[selectedDate] ?? []),
      }))
    },
    [selectedDate],
  )

  const getNavigationSnapshot = useCallback(
    (): NavigationSnapshot => ({
      currentView,
      selectedDate,
      calendarMonth,
      batchTaskId,
    }),
    [batchTaskId, calendarMonth, currentView, selectedDate],
  )

  const pushNavigationSnapshot = useCallback(() => {
    navigationHistoryRef.current.push(getNavigationSnapshot())
  }, [getNavigationSnapshot])

  const goToTasks = useCallback(() => {
    pushNavigationSnapshot()
    setBatchTaskId(null)
    setCurrentView('tasks')
  }, [pushNavigationSnapshot])

  const goToCalendar = useCallback(() => {
    if (featureSettings.calendarEnabled) {
      pushNavigationSnapshot()
      setCurrentView('calendar')
    }
  }, [featureSettings.calendarEnabled, pushNavigationSnapshot])
  const goToDiary = useCallback(() => {
    if (featureSettings.diaryEnabled) {
      pushNavigationSnapshot()
      setCurrentView('diary')
    }
  }, [featureSettings.diaryEnabled, pushNavigationSnapshot])
  const goToSettings = useCallback(() => {
    pushNavigationSnapshot()
    setCurrentView('settings')
  }, [pushNavigationSnapshot])

  const goBack = useCallback(() => {
    if ((currentView === 'diary' || currentView === 'diaryList') && isDiaryLoaded) {
      void saveDiaries(diarySyncData)
        .then(() => setDiaryError(''))
        .catch((saveError) => {
          console.error(saveError)
          setDiaryError(formatStoreError(saveError, 'save', 'diary'))
        })
    }

    const previousState = navigationHistoryRef.current.pop()

    if (previousState) {
      setSelectedDate(previousState.selectedDate)
      setCalendarMonth(previousState.calendarMonth)
      setBatchTaskId(previousState.batchTaskId)
      setCurrentView(previousState.currentView)
      return
    }

    setBatchTaskId(null)
    setCurrentView('tasks')
  }, [currentView, diarySyncData, isDiaryLoaded])

  const openBatchView = useCallback((taskId: string) => {
    pushNavigationSnapshot()
    setBatchTaskId(taskId)
    setCurrentView('batch')
  }, [pushNavigationSnapshot])

  const goToToday = useCallback(() => {
    const today = new Date()
    navigationHistoryRef.current = []
    setSelectedDate(todayKey)
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setBatchTaskId(null)
    setCurrentView('tasks')
  }, [todayKey])

  const openDiaryList = useCallback(() => {
    if (featureSettings.diaryEnabled) {
      pushNavigationSnapshot()
      setCurrentView('diaryList')
    }
  }, [featureSettings.diaryEnabled, pushNavigationSnapshot])

  const openDiaryDate = useCallback((dateKey: string) => {
    const date = fromDateKey(dateKey)
    if (featureSettings.diaryEnabled) {
      pushNavigationSnapshot()
    }
    setSelectedDate(dateKey)
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    if (featureSettings.diaryEnabled) {
      setCurrentView('diary')
    }
  }, [featureSettings.diaryEnabled, pushNavigationSnapshot])

  const selectDate = useCallback((date: Date) => {
    pushNavigationSnapshot()
    setSelectedDate(toDateKey(date))
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setCurrentView('tasks')
  }, [pushNavigationSnapshot])

  const moveMonth = useCallback((step: number) => {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + step, 1),
    )
  }, [])

  const getCalendarDayIndicator = useCallback(
    (dateKey: string): 'complete' | 'future' | null => {
      const dayTasks = (tasksByDate[dateKey] ?? []).filter((task) => !task.deletedAt)

      if (dayTasks.length === 0) {
        return null
      }

      if (dayTasks.every((task) => task.completed)) {
        return 'complete'
      }

      if (dateKey > todayKey) {
        return 'future'
      }

      return null
    },
    [tasksByDate, todayKey],
  )

  const handleAddTask = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const text = newTask.trim()
      if (!text) {
        return
      }

      updateSelectedTasks((tasks) => [createTask(text), ...tasks])
      setNewTask('')
    },
    [newTask, updateSelectedTasks],
  )

  const toggleTask = useCallback(
    (taskId: string) => {
      const now = new Date().toISOString()
      updateSelectedTasks((tasks) =>
        tasks.map((task) =>
          task.id === taskId
            ? { ...task, completed: !task.completed, updatedAt: now }
            : task,
        ),
      )
    },
    [updateSelectedTasks],
  )

  const deleteTask = useCallback(
    (taskId: string) => {
      const now = new Date().toISOString()
      updateSelectedTasks((tasks) =>
        tasks.map((task) => (task.id === taskId ? { ...task, deletedAt: now, updatedAt: now } : task)),
      )
      setRecurringRules((rules) => rules.filter((rule) => rule.taskId !== taskId))
    },
    [updateSelectedTasks],
  )

  const updateBatchWeekdays = useCallback(
    (nextWeekdays: number[]) => {
      if (!batchTask) {
        return
      }

      const now = new Date().toISOString()
      const existingRule = recurringRules.find((rule) => rule.taskId === batchTask.id)
      let nextRules: RecurringRule[]
      let linkedRuleId: string | undefined

      if (nextWeekdays.length === 0) {
        nextRules = existingRule
          ? recurringRules.filter((rule) => rule.id !== existingRule.id)
          : recurringRules
        linkedRuleId = undefined
      } else if (!existingRule) {
        linkedRuleId = crypto.randomUUID()
        nextRules = [
          ...recurringRules,
          {
            id: linkedRuleId,
            taskId: batchTask.id,
            text: batchTask.text,
            weekdays: nextWeekdays,
            reminderTime: DEFAULT_REMINDER_TIME,
            updatedAt: now,
          },
        ]
      } else {
        linkedRuleId = existingRule.id
        nextRules = recurringRules.map((rule) =>
          rule.id === existingRule.id
            ? {
                ...rule,
                weekdays: nextWeekdays,
                reminderTime: rule.reminderTime ?? DEFAULT_REMINDER_TIME,
                updatedAt: now,
              }
            : rule,
        )
      }

      setRecurringRules(nextRules)

      updateSelectedTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== batchTask.id) {
            return task
          }

          if (!linkedRuleId) {
            const rest: TodoTask = { ...task }
            delete rest.recurringRuleId
            return { ...rest, updatedAt: now }
          }

          return { ...task, recurringRuleId: linkedRuleId, updatedAt: now }
        }),
      )

      if (linkedRuleId) {
        setTasksByDate((current) =>
          applyRecurringRulesForDate(current, nextRules, toDateKey(new Date())),
        )
      }
    },
    [batchTask, recurringRules, updateSelectedTasks],
  )

  const toggleBatchWeekday = useCallback(
    (weekday: number) => {
      const selectedWeekdays = batchRule?.weekdays ?? []
      const nextWeekdays = selectedWeekdays.includes(weekday)
        ? selectedWeekdays.filter((value) => value !== weekday)
        : [...selectedWeekdays, weekday]

      updateBatchWeekdays(nextWeekdays)
    },
    [batchRule, updateBatchWeekdays],
  )

  const setBatchReminderTime = useCallback(
    (time: string) => {
      if (!batchTask || !/^\d{2}:\d{2}$/.test(time)) {
        return
      }

      const now = new Date().toISOString()
      const existingRule = getRecurringRuleForTask(batchTask, recurringRules)
      if (!existingRule) {
        return
      }

      setRecurringRules((rules) =>
        rules.map((rule) =>
          rule.id === existingRule.id ? { ...rule, reminderTime: time, updatedAt: now } : rule,
        ),
      )
    },
    [batchTask, recurringRules],
  )

  const handleAutoLaunchChange = useCallback(async (enabled: boolean) => {
    setAutoLaunchEnabled(enabled)

    try {
      const confirmedEnabled = await window.todoStore?.setAutoLaunch(enabled)
      setAutoLaunchEnabled(Boolean(confirmedEnabled))
      setError('')
    } catch (settingsError) {
      console.error(settingsError)
      setAutoLaunchEnabled(!enabled)
      setError('开机自启动设置失败，请稍后再试。')
    }
  }, [])

  const handleFeatureSettingChange = useCallback(
    (setting: keyof FeatureSettings, enabled: boolean) => {
      setFeatureSettings((settings) => ({
        ...settings,
        [setting]: enabled,
      }))

      if (!enabled && setting === 'calendarEnabled' && currentView === 'calendar') {
        setCurrentView('tasks')
      }

      if (
        !enabled &&
        setting === 'diaryEnabled' &&
        (currentView === 'diary' || currentView === 'diaryList')
      ) {
        setCurrentView('tasks')
      }
    },
    [currentView],
  )

  const handleGitHubSyncSettingChange = useCallback(
    (setting: keyof GitHubSyncSettings, value: string | boolean) => {
      setGitHubSyncSettings((current) => {
        const next = normalizeGitHubSyncSettings({
          ...current,
          [setting]: value,
        })

        saveGitHubSyncSettings(next)
        setGitHubSyncStatus(
          next.enabled
            ? { state: 'idle', message: '等待同步' }
            : { state: 'idle', message: '未开启同步' },
        )

        return next
      })
    },
    [],
  )

  const syncGitHubNow = useCallback(async () => {
    if (!hasGitHubSyncCredentials(githubSyncSettings)) {
      setGitHubSyncStatus({
        state: 'error',
        message: '请先填写完整的 GitHub 同步设置',
      })
      return
    }

    if (isGitHubSyncingRef.current) {
      hasQueuedGitHubSyncRef.current = true
      setGitHubSyncStatus((status) => ({
        ...status,
        state: 'syncing',
        message: '已有同步正在进行，稍后会继续同步',
      }))
      window.setTimeout(() => {
        setGitHubSyncRetryTick((tick) => tick + 1)
      }, GITHUB_SYNC_DEBOUNCE_MS)
      return
    }

    isGitHubSyncingRef.current = true
    try {
      setGitHubSyncStatus({ state: 'syncing', message: '正在和 GitHub 同步' })

      const remoteData = await pullGitHubData(githubSyncSettings)
      const nextTasks = mergeAppData(
        { tasksByDate, recurringRules, featureSettings },
        remoteData.tasks,
      )
      const nextDiarySync = mergeDiarySyncData(diarySyncData, remoteData.diaries)
      const syncedTasksByDate = applyRecurringRulesForDate(
        nextTasks.tasksByDate,
        nextTasks.recurringRules,
        toDateKey(new Date()),
      )
      const syncedPayload: AppData = {
        ...nextTasks,
        tasksByDate: pruneExpiredRecurringTasks(syncedTasksByDate),
      }

      skipNextAutoSyncRef.current = true
      setTasksByDate(syncedPayload.tasksByDate)
      setRecurringRules(nextTasks.recurringRules)
      setFeatureSettings(nextTasks.featureSettings)
      setDiarySyncData(nextDiarySync)

      await Promise.all([saveTasks(syncedPayload), saveDiaries(nextDiarySync)])
      await pushGitHubData(githubSyncSettings, {
        tasks: syncedPayload,
        diaries: nextDiarySync,
      })

      setGitHubSyncStatus({
        state: 'success',
        message: '已和 GitHub 同步',
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (syncError) {
      console.error(syncError)
      setGitHubSyncStatus({
        state: 'error',
        message: `GitHub 同步失败：${getErrorMessage(syncError)}`,
      })
    } finally {
      isGitHubSyncingRef.current = false
    }
  }, [
    diarySyncData,
    featureSettings,
    githubSyncSettings,
    recurringRules,
    tasksByDate,
  ])

  const hasBatchScheduleForTask = useCallback(
    (task: TodoTask) => {
      const rule = getRecurringRuleForTask(task, recurringRules)
      return rule != null && rule.weekdays.length > 0
    },
    [recurringRules],
  )

  const value = useMemo<TodoContextValue>(
    () => ({
      currentView,
      error,
      todayKey,
      selectedDate,
      selectedTasks,
      isReadOnlyDate,
      batchTask,
      batchRule,
      headerTitle,
      completedCount,
      progressPercent,
      monthDays,
      calendarMonth,
      tasksByDate,
      recurringRules,
      newTask,
      autoLaunchEnabled,
      featureSettings,
      githubSyncSettings,
      githubSyncStatus,
      setNewTask,
      goToTasks,
      goToCalendar,
      goToDiary,
      goToSettings,
      goBack,
      goToToday,
      selectedDiary,
      diaryEntries,
      updateDiary,
      hasSelectedDiary,
      isDiaryReadOnly,
      diaryError,
      openDiaryList,
      openDiaryDate,
      openBatchView,
      selectDate,
      moveMonth,
      getCalendarDayIndicator,
      handleAddTask,
      toggleTask,
      deleteTask,
      toggleBatchWeekday,
      setBatchReminderTime,
      handleAutoLaunchChange,
      handleFeatureSettingChange,
      handleGitHubSyncSettingChange,
      syncGitHubNow,
      hasBatchSchedule: hasBatchScheduleForTask,
    }),
    [
      autoLaunchEnabled,
      batchRule,
      batchTask,
      calendarMonth,
      completedCount,
      currentView,
      diaryEntries,
      error,
      featureSettings,
      getCalendarDayIndicator,
      goBack,
      diaryError,
      goToCalendar,
      goToDiary,
      goToSettings,
      goToTasks,
      goToToday,
      handleAddTask,
      handleAutoLaunchChange,
      handleFeatureSettingChange,
      handleGitHubSyncSettingChange,
      hasBatchScheduleForTask,
      headerTitle,
      githubSyncSettings,
      githubSyncStatus,
      isReadOnlyDate,
      monthDays,
      moveMonth,
      newTask,
      openDiaryList,
      openDiaryDate,
      openBatchView,
      progressPercent,
      recurringRules,
      selectDate,
      selectedDate,
      selectedTasks,
      tasksByDate,
      hasSelectedDiary,
      isDiaryReadOnly,
      selectedDiary,
      todayKey,
      toggleBatchWeekday,
      setBatchReminderTime,
      syncGitHubNow,
      updateDiary,
      toggleTask,
      deleteTask,
    ],
  )

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}

export function useTodo() {
  const context = useContext(TodoContext)
  if (!context) {
    throw new Error('useTodo must be used within TodoProvider')
  }

  return context
}
