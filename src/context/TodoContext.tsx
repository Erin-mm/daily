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
import { hasDiaryContent, normalizeDiaries, withDiaryEntry } from '../lib/diary'
import { formatStoreError, loadDiaries, saveDiaries } from '../lib/store'
import { formatSelectedDateTitle, type HeaderTitle } from '../lib/format'
import { fromDateKey, getMonthDays, isPastDate, toDateKey } from '../lib/date'
import {
  applyRecurringRulesForDate,
  getRecurringRuleForTask,
  RECURRING_SYNC_INTERVAL_MS,
} from '../lib/recurring'
import { createTask, normalizeAppData } from '../lib/tasks'
import type { AppData, DiariesByDate, RecurringRule, TasksByDate, TodoTask } from '../types/electron'

const DIARY_SAVE_DEBOUNCE_MS = 350

export type AppView = 'tasks' | 'calendar' | 'diary' | 'settings' | 'batch'

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
  isOnToday: boolean
  isCalendarOnCurrentMonth: boolean
  showTodayShortcut: boolean
  tasksByDate: TasksByDate
  recurringRules: RecurringRule[]
  newTask: string
  autoLaunchEnabled: boolean
  setNewTask: (value: string) => void
  goToTasks: () => void
  goToCalendar: () => void
  goToDiary: () => void
  goToSettings: () => void
  selectedDiary: string
  updateDiary: (content: string) => void
  hasTodayDiary: boolean
  isDiaryReadOnly: boolean
  diaryError: string
  goBack: () => void
  goToToday: () => void
  openBatchView: (taskId: string) => void
  selectDate: (date: Date) => void
  moveMonth: (step: number) => void
  getCalendarDayIndicator: (dateKey: string) => 'complete' | 'future' | null
  handleAddTask: (event: FormEvent<HTMLFormElement>) => void
  toggleTask: (taskId: string) => void
  deleteTask: (taskId: string) => void
  toggleBatchWeekday: (weekday: number) => void
  handleAutoLaunchChange: (enabled: boolean) => void
  hasBatchSchedule: (task: TodoTask) => boolean
}

const TodoContext = createContext<TodoContextValue | null>(null)

export function TodoProvider({ children }: { children: ReactNode }) {
  const [tasksByDate, setTasksByDate] = useState<TasksByDate>({})
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([])
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [calendarMonth, setCalendarMonth] = useState(() => fromDateKey(toDateKey(new Date())))
  const [newTask, setNewTask] = useState('')
  const [currentView, setCurrentView] = useState<AppView>('tasks')
  const [batchTaskId, setBatchTaskId] = useState<string | null>(null)
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false)
  const [diariesByDate, setDiariesByDate] = useState<DiariesByDate>({})
  const [isLoaded, setIsLoaded] = useState(false)
  const [isDiaryLoaded, setIsDiaryLoaded] = useState(false)
  const [error, setError] = useState('')
  const [diaryError, setDiaryError] = useState('')
  const skipDiarySaveRef = useRef(true)

  const todayKey = toDateKey(new Date())
  const selectedTasks = tasksByDate[selectedDate] ?? []
  const isReadOnlyDate = isPastDate(selectedDate)
  const batchTask = useMemo(
    () => selectedTasks.find((task) => task.id === batchTaskId) ?? null,
    [batchTaskId, selectedTasks],
  )
  const batchRule = useMemo(
    () => (batchTask ? getRecurringRuleForTask(batchTask, recurringRules) : undefined) ?? null,
    [batchTask, recurringRules],
  )
  const selectedDiary = diariesByDate[selectedDate] ?? ''
  const hasTodayDiary = hasDiaryContent(diariesByDate[todayKey])
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
  const isOnToday = selectedDate === todayKey
  const isCalendarOnCurrentMonth =
    calendarMonth.getFullYear() === new Date().getFullYear() &&
    calendarMonth.getMonth() === new Date().getMonth()
  const showTodayShortcut =
    currentView !== 'settings' &&
    (!isOnToday || (currentView === 'calendar' && !isCalendarOnCurrentMonth))

  useEffect(() => {
    let isMounted = true

    async function loadTasks() {
      try {
        const [storedTasks, autoLaunch] = await Promise.all([
          window.todoStore?.loadTasks(),
          window.todoStore?.getAutoLaunch(),
        ])

        if (isMounted && storedTasks) {
          const { tasksByDate: loadedTasks, recurringRules: loadedRules } =
            normalizeAppData(storedTasks)

          setRecurringRules(loadedRules)
          setTasksByDate(
            applyRecurringRulesForDate(loadedTasks, loadedRules, toDateKey(new Date())),
          )
        }

        if (isMounted && typeof autoLaunch === 'boolean') {
          setAutoLaunchEnabled(autoLaunch)
        }

        if (isMounted) {
          try {
            const storedDiaries = await loadDiaries()
            setDiariesByDate(normalizeDiaries(storedDiaries))
            setDiaryError('')
          } catch (diaryLoadError) {
            console.error(diaryLoadError)
            setDiaryError(formatStoreError(diaryLoadError, 'load', 'diary'))
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

    loadTasks()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    async function saveTasks() {
      try {
        const payload: AppData = { tasksByDate, recurringRules }
        await window.todoStore?.saveTasks(payload)
        setError('')
      } catch (saveError) {
        console.error(saveError)
        setError(formatStoreError(saveError, 'save', 'tasks'))
      }
    }

    saveTasks()
  }, [isLoaded, recurringRules, tasksByDate])

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
        await saveDiaries(diariesByDate)
        setDiaryError('')
      } catch (saveError) {
        console.error(saveError)
        setDiaryError(formatStoreError(saveError, 'save', 'diary'))
      }
    }, DIARY_SAVE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [diariesByDate, isDiaryLoaded])

  const updateDiary = useCallback(
    (content: string) => {
      if (selectedDate > todayKey) {
        return
      }

      setDiariesByDate((current) => withDiaryEntry(current, selectedDate, content))
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

  const goToTasks = useCallback(() => {
    setBatchTaskId(null)
    setCurrentView('tasks')
  }, [])

  const goToCalendar = useCallback(() => setCurrentView('calendar'), [])
  const goToDiary = useCallback(() => setCurrentView('diary'), [])
  const goToSettings = useCallback(() => setCurrentView('settings'), [])

  const goBack = useCallback(() => {
    if (currentView === 'diary' && isDiaryLoaded) {
      void saveDiaries(diariesByDate)
        .then(() => setDiaryError(''))
        .catch((saveError) => {
          console.error(saveError)
          setDiaryError(formatStoreError(saveError, 'save', 'diary'))
        })
    }

    if (currentView === 'batch') {
      setBatchTaskId(null)
      setCurrentView('tasks')
      return
    }

    setCurrentView('tasks')
  }, [currentView, diariesByDate, isDiaryLoaded])

  const openBatchView = useCallback((taskId: string) => {
    setBatchTaskId(taskId)
    setCurrentView('batch')
  }, [])

  const goToToday = useCallback(() => {
    const today = new Date()
    setSelectedDate(todayKey)
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setCurrentView((view) => (view === 'diary' ? 'diary' : 'tasks'))
  }, [todayKey])

  const selectDate = useCallback((date: Date) => {
    setSelectedDate(toDateKey(date))
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setCurrentView('tasks')
  }, [])

  const moveMonth = useCallback((step: number) => {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + step, 1),
    )
  }, [])

  const getCalendarDayIndicator = useCallback(
    (dateKey: string): 'complete' | 'future' | null => {
      const dayTasks = tasksByDate[dateKey] ?? []

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
      updateSelectedTasks((tasks) =>
        tasks.map((task) =>
          task.id === taskId ? { ...task, completed: !task.completed } : task,
        ),
      )
    },
    [updateSelectedTasks],
  )

  const deleteTask = useCallback(
    (taskId: string) => {
      updateSelectedTasks((tasks) => tasks.filter((task) => task.id !== taskId))
      setRecurringRules((rules) => rules.filter((rule) => rule.taskId !== taskId))
    },
    [updateSelectedTasks],
  )

  const updateBatchWeekdays = useCallback(
    (nextWeekdays: number[]) => {
      if (!batchTask) {
        return
      }

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
          },
        ]
      } else {
        linkedRuleId = existingRule.id
        nextRules = recurringRules.map((rule) =>
          rule.id === existingRule.id ? { ...rule, weekdays: nextWeekdays } : rule,
        )
      }

      setRecurringRules(nextRules)

      updateSelectedTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== batchTask.id) {
            return task
          }

          if (!linkedRuleId) {
            const { recurringRuleId: _removed, ...rest } = task
            return rest
          }

          return { ...task, recurringRuleId: linkedRuleId }
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
      isOnToday,
      isCalendarOnCurrentMonth,
      showTodayShortcut,
      tasksByDate,
      recurringRules,
      newTask,
      autoLaunchEnabled,
      setNewTask,
      goToTasks,
      goToCalendar,
      goToDiary,
      goToSettings,
      goBack,
      goToToday,
      selectedDiary,
      updateDiary,
      hasTodayDiary,
      isDiaryReadOnly,
      diaryError,
      openBatchView,
      selectDate,
      moveMonth,
      getCalendarDayIndicator,
      handleAddTask,
      toggleTask,
      deleteTask,
      toggleBatchWeekday,
      handleAutoLaunchChange,
      hasBatchSchedule: hasBatchScheduleForTask,
    }),
    [
      autoLaunchEnabled,
      batchRule,
      batchTask,
      calendarMonth,
      completedCount,
      currentView,
      error,
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
      hasBatchScheduleForTask,
      headerTitle,
      isCalendarOnCurrentMonth,
      isOnToday,
      isReadOnlyDate,
      monthDays,
      moveMonth,
      newTask,
      openBatchView,
      progressPercent,
      recurringRules,
      selectDate,
      selectedDate,
      selectedTasks,
      showTodayShortcut,
      tasksByDate,
      hasTodayDiary,
      isDiaryReadOnly,
      selectedDiary,
      todayKey,
      toggleBatchWeekday,
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
