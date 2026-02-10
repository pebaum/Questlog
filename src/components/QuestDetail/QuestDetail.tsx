import { useState, useEffect, useCallback } from 'react'
import { useQuestStore } from '../../store/questStore'
import ObjectiveList from './ObjectiveList'
import './QuestDetail.css'

const formatDate = (iso: string): string => {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const PRIORITY_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Low', color: 'var(--text-muted)' },
  { value: 2, label: 'Medium', color: 'var(--yellow)' },
  { value: 3, label: 'High', color: 'var(--red)' },
]

export default function QuestDetail() {
  const quest = useQuestStore(s => {
    if (!s.selectedQuestId) return null
    return s.quests.find(q => q.id === s.selectedQuestId) || null
  })
  const domains = useQuestStore(s => s.domains)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [description, setDescription] = useState('')
  const [descDirty, setDescDirty] = useState(false)
  const [waitingFor, setWaitingFor] = useState('')
  const [waitingDirty, setWaitingDirty] = useState(false)

  useEffect(() => {
    setEditingTitle(false)
    setDescription(quest?.description || '')
    setDescDirty(false)
    setWaitingFor(quest?.waiting_for || '')
    setWaitingDirty(false)
  }, [quest?.id, quest?.description, quest?.waiting_for])

  const handleToggleActive = useCallback(async () => {
    if (!quest) return
    const result = await window.questApi.updateQuest(quest.id, { active: !quest.active })
    if (result && 'error' in result) alert(result.error)
  }, [quest])

  const handleComplete = useCallback(async () => {
    if (!quest) return
    await window.questApi.updateQuest(quest.id, {
      completed_at: quest.completed_at ? null : new Date().toISOString(),
      active: false
    })
  }, [quest])

  const handleDelete = useCallback(async () => {
    if (!quest) return
    if (!confirm(`Delete "${quest.title}"?`)) return
    await window.questApi.deleteQuest(quest.id)
    useQuestStore.getState().selectQuest(null)
  }, [quest])

  const saveTitle = async () => {
    if (!quest || !titleValue.trim()) return
    await window.questApi.updateQuest(quest.id, { title: titleValue.trim() })
    setEditingTitle(false)
  }

  const handleDomainChange = async (domainId: string) => {
    if (!quest) return
    await window.questApi.updateQuest(quest.id, { domain: domainId })
  }

  const handlePriorityChange = async (priority: number) => {
    if (!quest) return
    await window.questApi.updateQuest(quest.id, { priority })
  }

  const saveDescription = async () => {
    if (!quest || !descDirty) return
    await window.questApi.updateQuest(quest.id, { description })
    setDescDirty(false)
  }

  const saveWaitingFor = async () => {
    if (!quest || !waitingDirty) return
    await window.questApi.updateQuest(quest.id, { waiting_for: waitingFor || null })
    setWaitingDirty(false)
  }

  if (!quest) {
    return (
      <div className="detail-empty">
        <span className="detail-empty-text">Select a quest to view details</span>
      </div>
    )
  }

  const domain = domains.find(d => d.id === quest.domain)
  const priorityOpt = PRIORITY_OPTIONS.find(p => p.value === quest.priority) || PRIORITY_OPTIONS[0]

  return (
    <div className="detail">
      {/* Header */}
      <div className="detail-header">
        <div className="detail-meta-row">
          <select className="input detail-select" value={quest.domain} onChange={e => handleDomainChange(e.target.value)}>
            <option value="">No domain</option>
            {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <select
            className="input detail-select"
            value={quest.priority}
            onChange={e => handlePriorityChange(Number(e.target.value))}
            style={priorityOpt.color ? { color: priorityOpt.color } : undefined}
          >
            {PRIORITY_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <div style={{ flex: 1 }} />

          <button className={`btn ${quest.active ? 'btn-active-on' : ''}`} onClick={handleToggleActive}>
            {quest.active ? '\u25C9 Active' : '\u25CB Set Active'}
          </button>
        </div>

        {editingTitle ? (
          <input
            className="input detail-title-input"
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => e.key === 'Enter' && saveTitle()}
            autoFocus
          />
        ) : (
          <h1 className="detail-title" onDoubleClick={() => { setTitleValue(quest.title); setEditingTitle(true) }}>
            {quest.title}
            {quest.completed_at && <span className="detail-complete-tag">done</span>}
          </h1>
        )}
      </div>

      <div className="divider" />

      {/* Objectives */}
      <div className="detail-section">
        <label className="detail-label">Objectives</label>
        <ObjectiveList questId={quest.id} objectives={quest.objectives} />
      </div>

      <div className="divider" />

      {/* Notes */}
      <div className="detail-section">
        <label className="detail-label">Notes</label>
        <textarea
          className="input detail-notes"
          value={description}
          onChange={e => { setDescription(e.target.value); setDescDirty(true) }}
          onBlur={saveDescription}
          placeholder="Add notes..."
        />
      </div>

      {/* Waiting for */}
      <div className="detail-section">
        <label className="detail-label">Waiting for</label>
        <input
          className="input detail-waiting-input"
          value={waitingFor}
          onChange={e => { setWaitingFor(e.target.value); setWaitingDirty(true) }}
          onBlur={saveWaitingFor}
          onKeyDown={e => e.key === 'Enter' && saveWaitingFor()}
          placeholder="Person or thing blocking this..."
        />
      </div>

      <div className="divider" />

      <div className="detail-actions">
        <button className="btn" onClick={handleComplete}>
          {quest.completed_at ? 'Reopen' : '\u2713 Complete'}
        </button>
        <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
      </div>

      <div className="detail-timestamps">
        <span>Created: {formatDate(quest.created_at)}</span>
        {quest.updated_at !== quest.created_at && (
          <span>Updated: {formatDate(quest.updated_at)}</span>
        )}
      </div>
    </div>
  )
}
