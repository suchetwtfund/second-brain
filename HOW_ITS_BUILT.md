
# How Telos Is Built

A simple explanation of the app's architecture for non-technical readers.

---

## The Big Picture

Think of the app like a restaurant:

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR BROWSER                           │
│                    (The Dining Room)                        │
│                                                             │
│   What you see and interact with - buttons, cards, search   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                     NEXT.JS SERVER                          │
│                      (The Kitchen)                          │
│                                                             │
│   Prepares pages, fetches data, handles logic               │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                       SUPABASE                              │
│                    (The Pantry/Storage)                     │
│                                                             │
│   Stores all your items, folders, tags, and user accounts   │
└─────────────────────────────────────────────────────────────┘
```

---

## The Three Main Parts

### 1. Frontend (What You See)
**Technology**: Next.js + React + Tailwind CSS

This is everything visible in your browser:
- The dark theme and colors
- Buttons, cards, sidebar
- Search box, filter dropdown
- The grid/list of your saved items

**Key files**:
```
src/components/
├── dashboard.tsx          → Main screen with all your items
├── layout/
│   ├── header.tsx         → Top bar with search and filters
│   └── sidebar.tsx        → Left panel with folders and tags
├── items/
│   ├── item-card.tsx      → Each card showing a saved link
│   └── add-item-dialog.tsx → Popup to add new items
└── ui/                    → Basic building blocks (buttons, inputs, etc.)
```

### 2. Backend (The Brain)
**Technology**: Next.js API Routes

This handles the logic that runs on the server:
- Checking if you're logged in
- Fetching metadata when you paste a URL
- Deciding if a link is a video, article, or tweet

**Key files**:
```
src/app/
├── api/
│   └── metadata/route.ts  → Fetches title, image, description from URLs
├── page.tsx               → Home page (shows dashboard if logged in)
├── login/page.tsx         → Login screen
├── folder/[id]/page.tsx   → Shows items in a specific folder
└── tag/[id]/page.tsx      → Shows items with a specific tag

src/middleware.ts          → Guards pages (redirects to login if not signed in)
```

### 3. Database (Storage)
**Technology**: Supabase (PostgreSQL)

This is where all your data lives permanently:

```
┌─────────────────────────────────────────────────────────────┐
│                        TABLES                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  USERS (handled by Supabase)                                │
│  ├── id, email, password                                    │
│                                                             │
│  FOLDERS                                                    │
│  ├── id                                                     │
│  ├── user_id (who owns it)                                  │
│  ├── name ("Work", "Learning", etc.)                        │
│  └── created_at                                             │
│                                                             │
│  ITEMS                                                      │
│  ├── id                                                     │
│  ├── user_id (who owns it)                                  │
│  ├── type ("link" or "note")                                │
│  ├── url                                                    │
│  ├── title                                                  │
│  ├── description                                            │
│  ├── thumbnail (image URL)                                  │
│  ├── content_type ("video", "article", "tweet", etc.)       │
│  ├── folder_id (which folder it's in)                       │
│  ├── status ("unread", "read", "archived")                  │
│  └── created_at                                             │
│                                                             │
│  TAGS                                                       │
│  ├── id                                                     │
│  ├── user_id                                                │
│  ├── name ("important", "to-read", etc.)                    │
│  └── color ("#3b82f6")                                      │
│                                                             │
│  ITEM_TAGS (connects items to tags)                         │
│  ├── item_id                                                │
│  └── tag_id                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Database file**: `supabase/schema.sql` contains all the table definitions

---

## How Key Features Work

### When You Add a Link

```
1. You paste: https://youtube.com/watch?v=abc123
                    ↓
2. Frontend sends URL to: /api/metadata
                    ↓
3. Backend fetches the YouTube page
                    ↓
4. Backend extracts: title, thumbnail, description
                    ↓
5. Backend detects type: "video" (because youtube.com)
                    ↓
6. Frontend shows preview, you click "Add"
                    ↓
7. Data saved to Supabase "items" table
                    ↓
8. Card appears in your dashboard
```

### Smart Article Detection

When you add a link, the app checks multiple signals:

```
1. Is it YouTube/Vimeo?           → Video
2. Is it Substack?                → Substack
3. Is it Twitter/X?               → Tweet
4. Does the page have og:type="article"? → Article
5. Does the page have <article> HTML tag? → Article
6. Does URL contain /blog/ or /post/? → Article
7. Is it Medium, Dev.to, etc.?    → Article
8. None of the above?             → Link
```

**File**: `src/app/api/metadata/route.ts` (lines 55-128)

### Filtering (Multi-Select)

```
State stored in dashboard.tsx:
├── filterStatus: "all" | "unread" | "read"
└── filterTypes: ["video", "article"] (array, can have multiple)

When filtering:
1. Get all items from state
2. If filterStatus !== "all" → keep only matching status
3. If filterTypes has items → keep only matching types
4. Show the filtered results
```

**Files**:
- `src/components/layout/header.tsx` (filter UI)
- `src/components/dashboard.tsx` (filter logic, lines 250-273)

### Authentication

```
1. User enters email + password
2. Supabase checks credentials
3. If valid → creates a session cookie
4. Middleware checks cookie on every page
5. No cookie? → Redirect to /login
```

**Files**:
- `src/app/login/page.tsx` (login form)
- `src/middleware.ts` (protects pages)
- `src/lib/supabase/server.ts` (server-side auth)
- `src/lib/supabase/client.ts` (browser-side auth)

---

## File Structure Overview

```
telos/
│
├── src/
│   ├── app/                    # Pages and API routes
│   │   ├── api/metadata/       # URL metadata fetching
│   │   ├── auth/callback/      # Auth redirect handler
│   │   ├── folder/[id]/        # Folder view page
│   │   ├── tag/[id]/           # Tag view page
│   │   ├── login/              # Login page
│   │   ├── page.tsx            # Home page
│   │   ├── layout.tsx          # App shell (wraps all pages)
│   │   └── globals.css         # Global styles + dark theme
│   │
│   ├── components/             # Reusable UI pieces
│   │   ├── dashboard.tsx       # Main dashboard logic
│   │   ├── dashboard-wrapper.tsx # Loads dashboard on client
│   │   ├── command-palette.tsx # Cmd+K quick actions
│   │   ├── layout/             # Header and sidebar
│   │   ├── items/              # Item cards and add dialog
│   │   ├── dialogs/            # Folder/tag creation popups
│   │   └── ui/                 # Basic components (button, input, etc.)
│   │
│   ├── lib/                    # Utilities and helpers
│   │   ├── supabase/           # Database connection code
│   │   └── utils.ts            # Helper functions
│   │
│   └── middleware.ts           # Auth protection for routes
│
├── public/                     # Static files
│   ├── manifest.json           # PWA configuration
│   └── icon-192.svg            # App icon
│
├── supabase/
│   └── schema.sql              # Database table definitions
│
├── .env.local                  # Secret keys (Supabase credentials)
├── package.json                # Dependencies list
└── next.config.ts              # Next.js configuration
```

---

## Technologies Used

| Technology | What It Does | Why We Chose It |
|------------|--------------|-----------------|
| **Next.js** | Web framework | Handles both frontend and backend in one place |
| **React** | UI library | Makes building interactive UIs easy |
| **Tailwind CSS** | Styling | Fast way to style without writing CSS files |
| **shadcn/ui** | UI components | Pre-built buttons, dialogs, dropdowns |
| **Supabase** | Database + Auth | Free tier, easy to use, handles login for us |
| **TypeScript** | Programming language | Catches errors before they happen |
| **Vercel** | Hosting | Free, works perfectly with Next.js |

---

## Environment Variables

The app needs these secret keys (stored in `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co    # Your database URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...                # Public API key
```

These connect the app to your Supabase project.

---

## What Each Component Does

### Dashboard (`dashboard.tsx`)
The brain of the app. It:
- Holds all state (items, folders, tags, filters)
- Handles adding, deleting, archiving items
- Filters and searches items
- Coordinates all other components

### Header (`header.tsx`)
Top bar with:
- Search box (filters as you type)
- View toggle (grid/list)
- Filter dropdown (status + type checkboxes)

### Sidebar (`sidebar.tsx`)
Left panel with:
- Folders list (click to filter)
- Tags list (click to filter)
- Add New button
- Sign out

### Item Card (`item-card.tsx`)
Each saved item showing:
- Thumbnail image
- Title and description
- Type badge (Video, Article, etc.)
- Action buttons (read, archive, delete)

### Metadata API (`api/metadata/route.ts`)
When you paste a URL:
1. Fetches the page HTML
2. Extracts title, description, image from meta tags
3. Detects content type (video, article, tweet, etc.)
4. Returns data to the frontend

---

## Database Security

Supabase uses "Row Level Security" (RLS):
- Each user can only see their own data
- Even if someone guesses an item ID, they can't access it
- Rules defined in `supabase/schema.sql`

---

## Summary

```
┌──────────────────────────────────────────────────────────────┐
│                        TELOS APP                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  FRONTEND (React + Next.js)                                  │
│  └── What you see and click                                  │
│                                                              │
│  BACKEND (Next.js API Routes)                                │
│  └── Fetches metadata, handles logic                         │
│                                                              │
│  DATABASE (Supabase PostgreSQL)                              │
│  └── Stores items, folders, tags, users                      │
│                                                              │
│  AUTH (Supabase Auth)                                        │
│  └── Handles login, keeps data private                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The app is ~6,000 lines of code across 42 files, but the core logic lives in just a few key files:
- `dashboard.tsx` - Main app logic
- `header.tsx` - Search and filters
- `api/metadata/route.ts` - Smart content detection
- `schema.sql` - Database structure

---

*Built with Claude Opus 4.5*
