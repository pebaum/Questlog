import { useQuestStore } from '../../store/questStore'
import type { SortField } from '../../types/quest'
import './QuestList.css'

export default function QuestListFilters() {
  const filters = useQuestStore(s => s.filters)
  const domains = useQuestStore(s => s.domains)
  const setSearch = useQuestStore(s => s.setSearch)
  const setDomainFilter = useQuestStore(s => s.setDomainFilter)
  const setActiveOnly = useQuestStore(s => s.setActiveOnly)
  const setShowCompleted = useQuestStore(s => s.setShowCompleted)
  const setSort = useQuestStore(s => s.setSort)

  return (
    <div className="quest-filters">
      <input
        className="input quest-filters-search"
        placeholder="Search quests..."
        value={filters.search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="quest-filters-row">
        <select
          className="input quest-filters-select"
          value={filters.domain || ''}
          onChange={e => setDomainFilter(e.target.value || null)}
        >
          <option value="">All Domains</option>
          {domains.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          className="input quest-filters-select"
          value={filters.sortField}
          onChange={e => setSort(e.target.value as SortField)}
        >
          <option value="updated_at">Recent</option>
          <option value="title">Title</option>
          <option value="priority">Priority</option>
          <option value="domain">Domain</option>
        </select>
      </div>
      <div className="quest-filters-toggles">
        <label className="quest-filters-toggle">
          <input
            type="checkbox"
            checked={filters.activeOnly}
            onChange={e => setActiveOnly(e.target.checked)}
          />
          <span>Active only</span>
        </label>
        <label className="quest-filters-toggle">
          <input
            type="checkbox"
            checked={filters.showCompleted}
            onChange={e => setShowCompleted(e.target.checked)}
          />
          <span>Show completed</span>
        </label>
      </div>
    </div>
  )
}
