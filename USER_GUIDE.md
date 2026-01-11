# Telos - User Guide

Your personal knowledge hub for saving articles, videos, tweets, and notes.

---

## Getting Started

### Opening the App
- **On laptop**: Go to `http://localhost:3000` in your browser
- **On phone**: Same URL, or install as an app (see "Installing on Phone" below)

### Logging In
1. Enter your email and password
2. Click "Sign In"
3. First time? Click "Sign up" to create an account

---

## Saving Content

### Adding a Link
1. Click the **"+ Add New"** button (top-left) or the floating **+** button (bottom-right on mobile)
2. Paste your URL
3. The app automatically fetches:
   - Title
   - Description
   - Thumbnail image
   - Content type (Video, Article, Tweet, etc.)
4. Click "Add Item"

### Adding a Note
1. Click **"+ Add New"**
2. Switch to the **"Note"** tab
3. Type your title and content
4. Click "Add Item"

---

## Organizing Your Content

### Folders
- Create folders to group related items (e.g., "Work", "Learning", "Recipes")
- Click **"+ New Folder"** in the sidebar
- Click a folder name to see only items in that folder

### Tags
- Add colorful labels to items (e.g., "important", "to-read", "favorite")
- Click **"+ New Tag"** in the sidebar
- Choose a color for your tag

---

## Finding Content

### Search
- Type in the search box (top-right)
- Results appear **instantly** as you type
- Searches through titles and descriptions

### Filtering

The filter button (sliders icon) lets you narrow down what you see:

**Status Filters** (pick one):
- **All Status** - Show everything
- **Unread only** - Items you haven't read/watched yet
- **Read only** - Items you've already consumed

**Type Filters** (pick multiple):
- **All Types** - Show all content types
- **Videos** - YouTube, Vimeo, etc.
- **Articles** - Blog posts, news articles
- **Substack** - Newsletter posts
- **Tweets** - Twitter/X posts
- **Links** - Other websites
- **Notes** - Your personal notes

**Combining Filters**:
- Select "Unread only" + "Videos" = See unwatched videos
- Select "Read only" + "Articles" + "Substack" = See articles and newsletters you've read

---

## Managing Items

### Mark as Read/Unread
- Click the **eye icon** on any item to toggle read status
- Unread items have a blue "Unread" badge

### Archive
- Click the **archive icon** to hide an item
- An "Undo" button appears if you change your mind

### Delete
- Click the **trash icon** to permanently remove an item
- An "Undo" button appears briefly

### Open Link
- Click anywhere on the card to open the original link in a new tab

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette (quick search & actions) |
| `Cmd/Ctrl + N` | Add new item |

---

## View Options

Toggle between two views using the buttons in the header:

- **Grid view** (default) - Cards with thumbnails, good for visual browsing
- **List view** - Compact rows, good for scanning many items quickly

---

## Installing on Phone (PWA)

Make the app feel like a native phone app:

### iPhone/iPad
1. Open the app in Safari
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"**

### Android
1. Open the app in Chrome
2. Tap the **menu** (three dots)
3. Tap **"Add to Home Screen"** or **"Install App"**

---

## How Content Types Are Detected

The app automatically figures out what kind of content you're saving:

| If the link is from... | It's classified as... |
|------------------------|----------------------|
| YouTube, Vimeo, Twitch | Video |
| Substack | Substack |
| Twitter/X, Threads | Tweet |
| Medium, Dev.to, blogs | Article |
| Sites with article structure | Article (smart detection) |
| Everything else | Link |

**Smart Article Detection**: Even if a site isn't a known blog platform, the app looks for clues like article metadata and content structure to correctly identify articles.

---

## Tips

1. **Use folders for projects** - Create a folder for each major project or area of life
2. **Use tags for status** - Create tags like "urgent", "someday", "reference"
3. **Review unread items weekly** - Filter by "Unread only" to see what you haven't consumed
4. **Use command palette** - Press `Cmd+K` for the fastest way to search and navigate

---

## Troubleshooting

**Items not showing?**
- Check your filters - you might have a filter active
- Click "All items" to reset all filters

**Thumbnail not loading?**
- Some sites block image loading
- The app tries multiple fallbacks (site icon, favicon)

**Search not finding items?**
- Search looks at titles and descriptions only
- Try different keywords

---

## Data & Privacy

- All your data is stored in your personal Supabase database
- Only you can see your saved items (protected by login)
- The app runs on Vercel's free tier

---

Built with Next.js, Supabase, and Tailwind CSS.
