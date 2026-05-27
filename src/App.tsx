import './App.css'
import { AppHeader } from './components/AppHeader'
import { TodoProvider, useTodo } from './context/TodoContext'
import { BatchPage } from './pages/BatchPage'
import { CalendarPage } from './pages/CalendarPage'
import { DiaryPage } from './pages/DiaryPage'
import { SettingsPage } from './pages/SettingsPage'
import { TasksPage } from './pages/TasksPage'

function AppContent() {
  const { currentView } = useTodo()

  return (
    <main className="app-shell">
      <section className="todo-card" aria-label="Daily">
        <AppHeader />
        <div className="card-body">
          {currentView === 'calendar' && <CalendarPage />}
          {currentView === 'diary' && <DiaryPage />}
          {currentView === 'batch' && <BatchPage />}
          {currentView === 'settings' && <SettingsPage />}
          {currentView === 'tasks' && <TasksPage />}
        </div>
      </section>
    </main>
  )
}

function App() {
  return (
    <TodoProvider>
      <AppContent />
    </TodoProvider>
  )
}

export default App
