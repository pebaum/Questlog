import { useEffect, useState } from 'react'
import { useQuestStore } from './store/questStore'
import QuestList from './components/QuestList/QuestList'
import QuestDetail from './components/QuestDetail/QuestDetail'
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/app.css'

export default function App() {
  const loadQuests = useQuestStore(s => s.loadQuests)
  const loadDomains = useQuestStore(s => s.loadDomains)
  const [journalConfigured, setJournalConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    window.questApi.getSettings().then(settings => {
      if (settings.importFolder) {
        setJournalConfigured(true)
        loadDomains()
        loadQuests()
      } else {
        setJournalConfigured(false)
      }
    })

    const unsub = window.questApi.onQuestsUpdated(() => {
      loadQuests()
      loadDomains()
    })
    return unsub
  }, [loadQuests, loadDomains])

  const handleJournalSetup = () => {
    setJournalConfigured(true)
    loadDomains()
    loadQuests()
  }

  // Still checking settings
  if (journalConfigured === null) return null

  // No journal configured — show welcome screen
  if (!journalConfigured) {
    return (
      <ErrorBoundary>
        <WelcomeScreen onComplete={handleJournalSetup} />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="app-layout">
        <div className="app-sidebar">
          <QuestList />
        </div>
        <div className="app-detail">
          <QuestDetail />
        </div>
      </div>
    </ErrorBoundary>
  )
}
