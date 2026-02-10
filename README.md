# QuestLog

A desktop QuestLog app for task and project management. Organize your life like an RPG — track quests, objectives, and priorities across domains.

## Features

- **Quest Journal** — Two-panel layout with quest list (grouped by domain) and detail view
- **Objectives** — Checkbox-based sub-tasks within each quest, drag to reorder
- **Priority System** — High / Medium / Low priority with color-coded indicators
- **Domains** — Categorize quests (Work, Personal, Home, etc.) with custom colors
- **Active Quests** — Pin up to 5 quests as "active" for focus
- **Desktop Overlay** — Always-on-top floating tracker showing active quests (Ctrl+Shift+Q to toggle)
- **Markdown Import** — Point at a folder of markdown files to bulk-import quests
- **Drag & Drop** — Move quests between domains by dragging

## Tech Stack

- Electron + React + TypeScript
- electron-vite (Vite-based build)
- sql.js (SQLite via WebAssembly)
- Zustand (state management)
- @dnd-kit (drag and drop)

## Getting Started

```bash
npm install
npm run dev
```

On first launch, use the import button to point at a folder containing `.md` quest files. Files should have YAML frontmatter with `domain`, `active`, and `waiting_for` fields.

## Roadmap

- [ ] Brain dump parser — paste unstructured text, AI extracts quests
- [ ] Tome of Values integration — AI-assisted priority scoring based on personal values
- [ ] Quest templates
- [ ] Export back to markdown
