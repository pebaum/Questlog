import { useState } from 'react'
import type { QuestWithObjectives } from '../../types/quest'

interface Props {
  quest: QuestWithObjectives
  priorityColor?: string
}

export default function OverlayCard({ quest, priorityColor }: Props) {
  const [expanded, setExpanded] = useState(true)
  const visibleObjectives = quest.objectives.slice(0, 5)

  const handleToggleObjective = async (objId: string, currentCompleted: boolean) => {
    await window.questApi.updateObjective(objId, { completed: !currentCompleted })
  }

  return (
    <div className="overlay-card">
      <button className="overlay-card-header" onClick={() => setExpanded(!expanded)}>
        {priorityColor && <span className="overlay-card-priority" style={{ background: priorityColor }} />}
        <span className="overlay-card-title">{quest.title}</span>
        <span className="overlay-card-chevron">{expanded ? '\u2212' : '+'}</span>
      </button>
      {expanded && visibleObjectives.length > 0 && (
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
