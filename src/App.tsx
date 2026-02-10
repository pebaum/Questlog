import { useEffect } from 'react'
import { useQuestStore } from './store/questStore'
import QuestList from './components/QuestList/QuestList'
import QuestDetail from './components/QuestDetail/QuestDetail'
import './styles/app.css'

export default function App() {
  const loadQuests = useQuestStore(s => s.loadQuests)
  const loadDomains = useQuestStore(s => s.loadDomains)

  useEffect(() => {
    loadDomains()
    loadQuests()

    const unsub = window.questApi.onQuestsUpdated(() => {
      loadQuests()
      loadDomains()
    })
    return unsub
  }, [loadQuests, loadDomains])

  return (
    <div className="app-layout">
      <div className="app-sidebar">
        <QuestList />
      </div>
      <div className="app-detail">
        <QuestDetail />
      </div>
    </div>
  )
}
