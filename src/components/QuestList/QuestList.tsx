import { useState, useMemo } from 'react'
import { useQuestStore } from '../../store/questStore'
import type { QuestWithObjectives } from '../../types/quest'
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import QuestListFilters from './QuestListFilters'
import './QuestList.css'

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  3: { label: 'H', color: 'var(--red)' },
  2: { label: 'M', color: 'var(--yellow)' },
  1: { label: 'L', color: 'var(--green)' },
  0: { label: '', color: 'transparent' }
}

function PriorityDot({ priority }: { priority: number }) {
  const p = PRIORITY_LABELS[priority] || PRIORITY_LABELS[0]
  if (!p.label) return null
  return <span className="quest-item-priority" style={{ color: p.color }} title={`Priority: ${p.label}`}>{p.label}</span>
}

function DraggableQuestItem({ quest, selected, onClick, onToggleActive }: {
  quest: QuestWithObjectives
  selected: boolean
  onClick: () => void
  onToggleActive: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: quest.id })

  return (
    <div
      ref={setNodeRef}
      className={`quest-item ${selected ? 'quest-item--selected' : ''} ${isDragging ? 'quest-item--dragging' : ''}`}
      onClick={onClick}
    >
      <button
        className={`quest-item-active-check ${quest.active ? 'quest-item-active-check--on' : ''}`}
        onClick={onToggleActive}
        title={quest.active ? 'Active' : 'Set active'}
      >
        {quest.active ? '\u25C9' : '\u25CB'}
      </button>
      <PriorityDot priority={quest.priority} />
      <div className="quest-item-content" {...attributes} {...listeners}>
        <span className="quest-item-title">{quest.title}</span>
      </div>
      {quest.waiting_for && <span className="quest-item-waiting" title={`Waiting: ${quest.waiting_for}`}>{'\u23F3'}</span>}
    </div>
  )
}

function DroppableDomainGroup({ domainId, domainName, domainColor, children }: {
  domainId: string
  domainName: string
  domainColor: string
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `domain:${domainId}` })
  return (
    <div ref={setNodeRef} className={`quest-group-drop ${isOver ? 'quest-group-drop--over' : ''}`}>
      {isOver && <div className="quest-group-drop-label">Move to <strong>{domainName}</strong></div>}
      {children}
    </div>
  )
}

export default function QuestList() {
  const quests = useQuestStore(s => s.quests)
  const domains = useQuestStore(s => s.domains)
  const filters = useQuestStore(s => s.filters)
  const selectedQuestId = useQuestStore(s => s.selectedQuestId)
  const selectQuest = useQuestStore(s => s.selectQuest)
  const updateDomain = useQuestStore(s => s.updateDomain)
  const deleteDomain = useQuestStore(s => s.deleteDomain)
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set())
  const [showNewQuest, setShowNewQuest] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showNewDomain, setShowNewDomain] = useState(false)
  const [newDomainName, setNewDomainName] = useState('')
  const [newDomainColor, setNewDomainColor] = useState('#6ea8e0')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null)
  const [editingDomainName, setEditingDomainName] = useState('')
  const [confirmDeleteDomainId, setConfirmDeleteDomainId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const grouped = useMemo(() => {
    let result = [...quests]
    if (!filters.showCompleted) result = result.filter(q => !q.completed_at)
    if (filters.activeOnly) result = result.filter(q => q.active)
    if (filters.domain) result = result.filter(q => q.domain === filters.domain)
    if (filters.search) {
      const s = filters.search.toLowerCase()
      result = result.filter(q =>
        q.title.toLowerCase().includes(s) ||
        q.description.toLowerCase().includes(s) ||
        q.waiting_for?.toLowerCase().includes(s)
      )
    }

    // Sort: active first, then by priority desc, then title
    result.sort((a, b) => {
      if (filters.sortField === 'title') return filters.sortDirection === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
      if (filters.sortField === 'priority') {
        const d = b.priority - a.priority
        return filters.sortDirection === 'asc' ? -d : d
      }
      // Default: active pinned top, then priority, then title
      if (a.active !== b.active) return a.active ? -1 : 1
      if (a.priority !== b.priority) return b.priority - a.priority
      return a.title.localeCompare(b.title)
    })

    const map = new Map<string, QuestWithObjectives[]>()
    const sortedDomains = [...domains].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    for (const d of sortedDomains) map.set(d.id, [])
    map.set('', [])
    for (const q of result) {
      const list = map.get(q.domain) || []
      list.push(q)
      map.set(q.domain, list)
    }
    // Remove uncategorized group if empty, but keep named domains visible
    if (map.has('') && map.get('')!.length === 0) map.delete('')
    return map
  }, [quests, domains, filters])

  const toggleDomain = (domainId: string) => {
    setCollapsedDomains(prev => {
      const next = new Set(prev)
      if (next.has(domainId)) next.delete(domainId)
      else next.add(domainId)
      return next
    })
  }

  const getDomainName = (domainId: string) => {
    if (!domainId) return 'Uncategorized'
    return domains.find(d => d.id === domainId)?.name || 'Unknown'
  }
  const getDomainColor = (domainId: string) => domains.find(d => d.id === domainId)?.color || '#666'

  const handleCreateQuest = async () => {
    if (!newTitle.trim()) return
    const quest = await window.questApi.createQuest({ title: newTitle.trim() })
    setNewTitle('')
    setShowNewQuest(false)
    selectQuest(quest.id)
  }

  const handleCreateDomain = async () => {
    if (!newDomainName.trim()) return
    await window.questApi.createDomain(newDomainName.trim(), newDomainColor)
    setNewDomainName('')
    setShowNewDomain(false)
  }

  const handleToggleActive = async (quest: QuestWithObjectives, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.questApi.updateQuest(quest.id, { active: !quest.active })
  }

  const handleDragStart = (event: DragStartEvent) => setDraggingId(event.active.id as string)
  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingId(null)
    const { active, over } = event
    if (!over) return
    const overId = over.id as string
    if (!overId.startsWith('domain:')) return
    const newDomainId = overId.replace('domain:', '')
    const quest = quests.find(q => q.id === active.id)
    if (!quest || quest.domain === newDomainId) return
    await window.questApi.updateQuest(quest.id, { domain: newDomainId })
  }

  const handleStartRename = (domainId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const domain = domains.find(d => d.id === domainId)
    if (!domain) return
    setEditingDomainId(domainId)
    setEditingDomainName(domain.name)
  }

  const handleFinishRename = async () => {
    if (editingDomainId && editingDomainName.trim()) {
      await updateDomain(editingDomainId, { name: editingDomainName.trim() })
    }
    setEditingDomainId(null)
    setEditingDomainName('')
  }

  const handleDeleteDomain = async (domainId: string) => {
    await deleteDomain(domainId)
    setConfirmDeleteDomainId(null)
  }

  const draggingQuest = draggingId ? quests.find(q => q.id === draggingId) : null

  return (
    <div className="quest-list">
      <div className="quest-list-header">
        <span className="quest-list-title">Quests</span>
        <div className="quest-list-header-actions">
          <button className="btn" onClick={async () => { await window.questApi.pickImportFolder() }} title="Import from folder">{'\uD83D\uDCC1'}</button>
          <button className="btn" onClick={() => setShowNewDomain(!showNewDomain)}>+ Domain</button>
          <button className="btn btn-primary" onClick={() => setShowNewQuest(!showNewQuest)}>+ Quest</button>
        </div>
      </div>

      {showNewDomain && (
        <div className="quest-list-new">
          <div className="quest-list-new-row">
            <input className="input" style={{ flex: 1 }} placeholder="Domain name..." value={newDomainName} onChange={e => setNewDomainName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateDomain()} autoFocus />
            <input type="color" value={newDomainColor} onChange={e => setNewDomainColor(e.target.value)} className="quest-list-color-picker" />
          </div>
          <div className="quest-list-new-actions">
            <button className="btn btn-primary" onClick={handleCreateDomain}>Create</button>
            <button className="btn" onClick={() => setShowNewDomain(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showNewQuest && (
        <div className="quest-list-new">
          <input className="input" style={{ width: '100%' }} placeholder="Quest title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateQuest()} autoFocus />
          <div className="quest-list-new-actions">
            <button className="btn btn-primary" onClick={handleCreateQuest}>Create</button>
            <button className="btn" onClick={() => setShowNewQuest(false)}>Cancel</button>
          </div>
        </div>
      )}

      <QuestListFilters />

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="quest-list-body">
          {Array.from(grouped.entries()).map(([domainId, domainQuests]) => (
            <div key={domainId} className="quest-group">
              {editingDomainId === domainId ? (
                <div className="quest-group-header quest-group-header--editing">
                  <span className="quest-group-dot" style={{ background: getDomainColor(domainId) }} />
                  <input
                    className="quest-group-rename-input"
                    value={editingDomainName}
                    onChange={e => setEditingDomainName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleFinishRename()
                      if (e.key === 'Escape') { setEditingDomainId(null); setEditingDomainName('') }
                    }}
                    onBlur={handleFinishRename}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="quest-group-header-row">
                  <button className="quest-group-header" onClick={() => toggleDomain(domainId)}>
                    <span className="quest-group-dot" style={{ background: getDomainColor(domainId) }} />
                    <span className="quest-group-name">{getDomainName(domainId)}</span>
                    <span className="quest-group-count">{domainQuests.length}</span>
                    <span className={`quest-group-chevron ${collapsedDomains.has(domainId) ? 'collapsed' : ''}`}>{'\u25BE'}</span>
                  </button>
                  {domainId && (
                    <div className="quest-group-actions">
                      <button className="quest-group-action-btn" onClick={(e) => handleStartRename(domainId, e)} title="Rename domain">{'\u270E'}</button>
                      <button className="quest-group-action-btn quest-group-action-btn--delete" onClick={(e) => { e.stopPropagation(); setConfirmDeleteDomainId(domainId) }} title="Delete domain">{'\u2715'}</button>
                    </div>
                  )}
                </div>
              )}

              {confirmDeleteDomainId === domainId && (
                <div className="quest-group-confirm-delete">
                  <span>Delete <strong>{getDomainName(domainId)}</strong>? Quests will be moved to Personal.</span>
                  <div className="quest-group-confirm-actions">
                    <button className="btn btn-danger" onClick={() => handleDeleteDomain(domainId)}>Delete</button>
                    <button className="btn" onClick={() => setConfirmDeleteDomainId(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {!collapsedDomains.has(domainId) && (
                <DroppableDomainGroup domainId={domainId} domainName={getDomainName(domainId)} domainColor={getDomainColor(domainId)}>
                  {domainQuests.map(q => (
                    <DraggableQuestItem key={q.id} quest={q} selected={q.id === selectedQuestId} onClick={() => selectQuest(q.id)} onToggleActive={(e) => handleToggleActive(q, e)} />
                  ))}
                </DroppableDomainGroup>
              )}
            </div>
          ))}

          {grouped.size === 0 && quests.length === 0 && (
            <div className="quest-list-empty quest-list-empty--first">
              <div className="quest-list-empty-title">No quests yet</div>
              <div className="quest-list-empty-desc">Create your first quest to begin your adventure</div>
              <button className="btn btn-primary quest-list-empty-btn" onClick={() => setShowNewQuest(true)}>+ New Quest</button>
            </div>
          )}
          {grouped.size === 0 && quests.length > 0 && (
            <div className="quest-list-empty">No quests match your filters</div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingQuest && (
            <div className="quest-item quest-item--overlay">
              <PriorityDot priority={draggingQuest.priority} />
              <span className="quest-item-title">{draggingQuest.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
