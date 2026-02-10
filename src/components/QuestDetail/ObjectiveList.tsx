import { useState } from 'react'
import type { Objective } from '../../types/quest'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DragEndEvent } from '@dnd-kit/core'

interface Props {
  questId: string
  objectives: Objective[]
}

function SortableObjective({ objective, onToggle, onDelete }: {
  objective: Objective
  onToggle: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: objective.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className={`objective ${objective.completed ? 'objective--done' : ''}`}>
      <span className="objective-grip" {...attributes} {...listeners}>{'\u2847'}</span>
      <input
        type="checkbox"
        className="objective-checkbox"
        checked={objective.completed}
        onChange={onToggle}
      />
      <span className={`objective-text ${objective.completed ? 'objective-text--done' : ''}`}>
        {objective.text}
      </span>
      <button className="objective-delete" onClick={onDelete} title="Remove">{'\u00D7'}</button>
    </div>
  )
}

export default function ObjectiveList({ questId, objectives }: Props) {
  const [newText, setNewText] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleAdd = async () => {
    if (!newText.trim()) return
    await window.questApi.createObjective(questId, newText.trim())
    setNewText('')
  }

  const handleToggle = async (obj: Objective) => {
    await window.questApi.updateObjective(obj.id, { completed: !obj.completed })
  }

  const handleDelete = async (id: string) => {
    await window.questApi.deleteObjective(id)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = objectives.findIndex(o => o.id === active.id)
    const newIndex = objectives.findIndex(o => o.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = [...objectives]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    await window.questApi.reorderObjectives(questId, reordered.map(o => o.id))
  }

  return (
    <div className="objective-list">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={objectives.map(o => o.id)} strategy={verticalListSortingStrategy}>
          {objectives.map(obj => (
            <SortableObjective
              key={obj.id}
              objective={obj}
              onToggle={() => handleToggle(obj)}
              onDelete={() => handleDelete(obj.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="objective-add">
        <input
          className="input objective-add-input"
          placeholder="Add objective..."
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
      </div>
    </div>
  )
}
