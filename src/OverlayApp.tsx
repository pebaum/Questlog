import { useEffect, useState, useCallback } from 'react'
import type { QuestWithObjectives } from './types/quest'
import OverlayCard from './components/Overlay/OverlayCard'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/overlay.css'

export default function OverlayApp() {
  const [quests, setQuests] = useState<QuestWithObjectives[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const loadActive = useCallback(async () => {
    const active = await window.questApi.getActiveQuests()
    active.sort((a, b) => b.priority - a.priority)
    setQuests(active)
  }, [])

  useEffect(() => {
    loadActive()
    const unsub = window.questApi.onQuestsUpdated(() => {
      loadActive()
    })
    return unsub
  }, [loadActive])

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.overlay-card')) return
    setDragging(true)
    setDragOffset({ x: e.screenX - window.screenX, y: e.screenY - window.screenY })
  }

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: MouseEvent) => window.moveTo(e.screenX - dragOffset.x, e.screenY - dragOffset.y)
    const handleUp = () => setDragging(false)
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp) }
  }, [dragging, dragOffset])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    window.questApi.showOverlayContextMenu()
  }

  return (
    <ErrorBoundary>
      <div className="overlay" onMouseDown={handleMouseDown} onContextMenu={handleContextMenu}>
        <div className="overlay-header">
          <span className="overlay-title">Active Quests</span>
          <div className="overlay-header-right">
            <button className="overlay-toggle" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? '\u25BE' : '\u25B4'}
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className="overlay-body">
            {quests.length === 0 ? (
              <div className="overlay-empty">No active quests</div>
            ) : (
              quests.map(q => <OverlayCard key={q.id} quest={q} />)
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
