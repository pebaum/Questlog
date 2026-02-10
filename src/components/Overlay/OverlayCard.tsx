import { useState, useRef, useEffect } from 'react'
import type { QuestWithObjectives } from '../../types/quest'

const PRIORITY_LEVELS = [0, 1, 2, 3] as const
const PRIORITY_LABELS: Record<number, string> = {
  0: 'None', 1: 'Low', 2: 'Medium', 3: 'High'
}
const PRIORITY_COLORS: Record<number, string> = {
  0: 'var(--text-muted)', 1: 'var(--green)', 2: 'var(--yellow)', 3: 'var(--red)'
}

interface Props {
  quest: QuestWithObjectives
  onDeactivated?: () => void
}

export default function OverlayCard({ quest, onDeactivated }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(quest.title)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const visibleObjectives = quest.objectives.slice(0, 5)

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus()
  }, [editingTitle])

  const handleToggleObjective = async (objId: string, currentCompleted: boolean) => {
    await window.questApi.updateObjective(objId, { completed: !currentCompleted })
  }

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTitleDraft(quest.title)
    setEditingTitle(true)
  }

  const handleTitleSave = async () => {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== quest.title) {
      await window.questApi.updateQuest(quest.id, { title: trimmed })
    }
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleSave()
    else if (e.key === 'Escape') setEditingTitle(false)
  }

  const handlePriorityCycle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const currentIdx = PRIORITY_LEVELS.indexOf(quest.priority as typeof PRIORITY_LEVELS[number])
    const nextPriority = PRIORITY_LEVELS[(currentIdx + 1) % PRIORITY_LEVELS.length]
    await window.questApi.updateQuest(quest.id, { priority: nextPriority })
  }

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await window.questApi.updateQuest(quest.id, { active: false })
    onDeactivated?.()
  }

  return (
    <div className="overlay-card">
      <div className="overlay-card-header" onClick={() => setExpanded(!expanded)}>
        <span
          className="overlay-card-priority"
          style={{ background: PRIORITY_COLORS[quest.priority] || PRIORITY_COLORS[0] }}
          onClick={handlePriorityCycle}
          title={`Priority: ${PRIORITY_LABELS[quest.priority] || 'None'} (click to cycle)`}
        />
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="overlay-inline-input overlay-title-input"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="overlay-card-title"
            onDoubleClick={handleTitleDoubleClick}
            title="Double-click to edit"
          >
            {quest.title}
          </span>
        )}
        <button
          className="overlay-card-pin"
          onClick={handleToggleActive}
          title="Deactivate quest"
        >
          {'\u2716'}
        </button>
        <span className="overlay-card-chevron">{expanded ? '\u2212' : '+'}</span>
      </div>
      {expanded && (
        <div className="overlay-card-objectives">
          {visibleObjectives.map(obj => (
            <label key={obj.id} className={`overlay-objective ${obj.completed ? 'overlay-objective--done' : ''}`}>
              <input
                type="checkbox"
                className="overlay-objective-check"
                checked={obj.completed}
                onChange={() => handleToggleObjective(obj.id, obj.completed)}
              />
              <span className="overlay-objective-text">{obj.text}</span>
            </label>
          ))}
          {quest.objectives.length > 5 && (
            <div className="overlay-objective-more">+{quest.objectives.length - 5} more</div>
          )}
        </div>
      )}
    </div>
  )
}
