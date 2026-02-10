import { useState } from 'react'
import './WelcomeScreen.css'

interface WelcomeScreenProps {
  onComplete: () => void
}

export default function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [loading, setLoading] = useState(false)

  const handleOpenExisting = async () => {
    setLoading(true)
    try {
      const result = await window.questApi.pickImportFolder()
      if (result) {
        onComplete()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = async () => {
    setLoading(true)
    try {
      const result = await window.questApi.initializeJournal()
      if (result) {
        onComplete()
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="welcome-screen">
        <div className="welcome-loading">
          <span>Setting up your journal...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <div className="welcome-icon">{'\u2694\uFE0F'}</div>
        <h1 className="welcome-title">Welcome to QuestLog</h1>
        <p className="welcome-tagline">Organize your life like an RPG</p>

        <div className="welcome-actions">
          <button className="welcome-btn welcome-btn--primary" onClick={handleCreateNew}>
            <span className="welcome-btn-icon">{'\u2728'}</span>
            <span className="welcome-btn-text">
              <span className="welcome-btn-label">Create New Journal</span>
              <span className="welcome-btn-desc">Start fresh with a new quest folder</span>
            </span>
          </button>

          <button className="welcome-btn" onClick={handleOpenExisting}>
            <span className="welcome-btn-icon">{'\uD83D\uDCC1'}</span>
            <span className="welcome-btn-text">
              <span className="welcome-btn-label">Open Existing Journal</span>
              <span className="welcome-btn-desc">Load quest files from an existing folder</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
