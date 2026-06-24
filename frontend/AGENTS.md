# Frontend

A client-only Next.js demo of the Kanban board. It runs fully in the browser with hardcoded data and no backend. Later parts of the project add a static build, login, persistence, and an AI sidebar.

## Stack

- Next.js 16.1.6 (App Router)
- React 19.2.3
- TypeScript 5
- Tailwind CSS 4 (via `@tailwindcss/postcss`)
- `@dnd-kit` (core, sortable, utilities) for drag and drop
- `clsx` for conditional class names
- Fonts: Space Grotesk (display) and Manrope (body), loaded in `layout.tsx`

## Structure

- `src/app/`
  - `layout.tsx` - root layout, font setup
  - `page.tsx` - home page, renders `KanbanBoard`
  - `globals.css` - Tailwind import and brand-color CSS variables
- `src/components/`
  - `AuthGate.tsx` - on load calls `GET /api/me`; renders `Login` when logged out, `KanbanBoard` (with logout) when logged in
  - `Login.tsx` - brand-styled sign-in form; posts to `/api/login`
  - `KanbanBoard.tsx` - loads the board from `GET /api/board` on mount, keeps optimistic local state, and persists changes with a debounced `PUT /api/board`; shows loading/error and a save indicator; optional `onLogout` adds a logout control
  - `KanbanColumn.tsx` - droppable column with editable title and card count
  - `KanbanCard.tsx` - draggable card; inline edit form (title + details), edit/remove controls
  - `KanbanCardPreview.tsx` - card shown in the drag overlay
  - `NewCardForm.tsx` - collapsible add-card form
- `src/lib/kanban.ts` - types `Card`, `Column`, `BoardData`; `initialData` (used by tests; the backend owns the runtime seed); `moveCard()` reorder/move logic; `createId()` id generator
- `src/lib/auth.ts` - same-origin, credentialed auth helpers: `getMe()`, `login()`, `logout()`
- `src/lib/board.ts` - same-origin, credentialed board persistence: `getBoard()`, `saveBoard()`
- `tests/kanban.spec.ts` - Playwright e2e tests

## Data and state

- Board state lives in `KanbanBoard` via `useState`, loaded from `GET /api/board` on mount.
- Normalized shape: `columns[]` (each with ordered `cardIds[]`) plus a `cards` lookup keyed by id.
- Changes are optimistic locally and persisted to the backend with a debounced `PUT /api/board`; a reload reflects the stored board.

## Styling

- Tailwind CSS 4 utilities plus brand-color CSS variables in `globals.css`:
  - Accent Yellow `#ecad0a`, Blue `#209dd7`, Purple `#753991`, Navy `#032147`, Gray `#888888`.

## Testing

- Unit (Vitest + Testing Library, jsdom): `src/components/KanbanBoard.test.tsx`, `src/lib/kanban.test.ts`
- E2E (Playwright, against `http://127.0.0.1:3000`): `tests/kanban.spec.ts`
- Scripts: `npm run test:unit`, `npm run test:e2e`, `npm run test:all`

## Commands

- `npm run dev` - start the dev server
- `npm run build` - production build
- `npm run start` - serve the production build
- `npm run lint` - ESLint

## Known gaps (handled in later project parts)
- No AI chat sidebar (Part 10)
