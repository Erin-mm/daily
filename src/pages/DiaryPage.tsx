import { useTodo } from '../context/TodoContext'

export function DiaryPage() {
  const {
    selectedDiary,
    updateDiary,
    isDiaryReadOnly,
    diaryError,
  } = useTodo()

  const placeholder = '记小盈'

  return (
    <section className="diary-panel" aria-label="日记">
      <textarea
        className="diary-editor"
        value={selectedDiary}
        placeholder={placeholder}
        readOnly={isDiaryReadOnly}
        onChange={(event) => updateDiary(event.target.value)}
      />
      {diaryError && <p className="error-message">{diaryError}</p>}
    </section>
  )
}
