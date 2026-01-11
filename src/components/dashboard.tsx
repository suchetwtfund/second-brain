'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/sidebar'
import { Header, type FilterStatus, type FilterType } from '@/components/layout/header'
import { ItemCard } from '@/components/items/item-card'
import { AddItemDialog } from '@/components/items/add-item-dialog'
import { CommandPalette } from '@/components/command-palette'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Plus, Inbox } from 'lucide-react'
import { toast } from 'sonner'
import { CreateFolderDialog } from '@/components/dialogs/create-folder-dialog'
import { CreateTagDialog } from '@/components/dialogs/create-tag-dialog'
import type { Item, Folder, Tag } from '@/lib/supabase/types'

interface DashboardProps {
  initialItems: Item[]
  initialFolders: Folder[]
  initialTags: Tag[]
  userId: string
  currentFolder?: Folder
  currentTag?: Tag
}

export function Dashboard({ initialItems, initialFolders, initialTags, userId, currentFolder, currentTag }: DashboardProps) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [createTagOpen, setCreateTagOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterTypes, setFilterTypes] = useState<FilterType[]>([])

  const router = useRouter()
  const supabase = createClient()

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setAddDialogOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleAddItem = async (data: { url?: string; title: string; content?: string; type: 'link' | 'note' }) => {
    let metadata: { title: string; description: string | null; thumbnail: string | null; contentType: string } = {
      title: data.title,
      description: null,
      thumbnail: null,
      contentType: data.type === 'note' ? 'note' : 'link',
    }

    // Fetch metadata for links
    if (data.url) {
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(data.url)}`)
        if (response.ok) {
          metadata = await response.json()
        }
      } catch {
        // Use defaults
      }
    }

    const { data: newItem, error } = await supabase
      .from('items')
      .insert({
        user_id: userId,
        type: data.type,
        url: data.url || null,
        title: data.title || metadata.title,
        description: metadata.description,
        thumbnail: metadata.thumbnail,
        content: data.content || null,
        content_type: metadata.contentType,
        status: 'unread',
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to add item')
      return
    }

    if (newItem) {
      setItems((prev) => [newItem as Item, ...prev])
      toast.success('Item added!')
    }
  }

  const handleMarkRead = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return

    const newStatus = item.status === 'read' ? 'unread' : 'read'
    const { error } = await supabase
      .from('items')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
      )
    }
  }

  const handleArchive = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return

    const previousStatus = item.status

    // Optimistically update UI
    setItems((prev) => prev.filter((i) => i.id !== id))

    const { error } = await supabase
      .from('items')
      .update({ status: 'archived' })
      .eq('id', id)

    if (error) {
      // Restore on error
      setItems((prev) => [item, ...prev])
      toast.error('Failed to archive item')
      return
    }

    toast.success('Item archived', {
      action: {
        label: 'Undo',
        onClick: async () => {
          await supabase.from('items').update({ status: previousStatus }).eq('id', id)
          setItems((prev) => [{ ...item, status: previousStatus }, ...prev])
        },
      },
    })
  }

  const handleDelete = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return

    // Optimistically update UI
    setItems((prev) => prev.filter((i) => i.id !== id))

    const { error } = await supabase.from('items').delete().eq('id', id)

    if (error) {
      // Restore on error
      setItems((prev) => [item, ...prev])
      toast.error('Failed to delete item')
      return
    }

    toast.success('Item deleted', {
      action: {
        label: 'Undo',
        onClick: async () => {
          // Re-insert the item
          const { data: restored } = await supabase
            .from('items')
            .insert({
              user_id: item.user_id,
              type: item.type,
              url: item.url,
              title: item.title,
              description: item.description,
              thumbnail: item.thumbnail,
              content: item.content,
              folder_id: item.folder_id,
              status: item.status,
              content_type: item.content_type,
            })
            .select()
            .single()

          if (restored) {
            setItems((prev) => [restored as Item, ...prev])
            toast.success('Item restored')
          }
        },
      },
    })
  }

  const handleCreateFolder = async (name: string) => {
    const { data: newFolder, error } = await supabase
      .from('folders')
      .insert({ user_id: userId, name })
      .select()
      .single()

    if (error) {
      toast.error('Failed to create folder')
      return
    }

    if (newFolder) {
      setFolders((prev) => [...prev, newFolder as Folder])
      toast.success(`Folder "${name}" created`)
    }
  }

  const handleCreateTag = async (name: string, color: string) => {
    const { data: newTag, error } = await supabase
      .from('tags')
      .insert({ user_id: userId, name, color })
      .select()
      .single()

    if (error) {
      toast.error('Failed to create tag')
      return
    }

    if (newTag) {
      setTags((prev) => [...prev, newTag as Tag])
      toast.success(`Tag "${name}" created`)
    }
  }

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    // In a real app, you'd filter items or make an API call
  }, [])

  const filteredItems = items.filter((item) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!item.title.toLowerCase().includes(query) &&
          !item.description?.toLowerCase().includes(query)) {
        return false
      }
    }

    // Status filter
    if (filterStatus !== 'all' && item.status !== filterStatus) {
      return false
    }

    // Type filter (multi-select)
    if (filterTypes.length > 0 && !filterTypes.includes(item.content_type as FilterType)) {
      return false
    }

    return true
  })

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          folders={folders}
          tags={tags}
          onSignOut={handleSignOut}
          onCreateFolder={() => setCreateFolderOpen(true)}
          onCreateTag={() => setCreateTagOpen(true)}
          onAddItem={() => setAddDialogOpen(true)}
        />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar
            folders={folders}
            tags={tags}
            onSignOut={handleSignOut}
            onCreateFolder={() => setCreateFolderOpen(true)}
            onCreateTag={() => setCreateTagOpen(true)}
            onAddItem={() => setAddDialogOpen(true)}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={currentFolder ? currentFolder.name : currentTag ? currentTag.name : "All Items"}
          itemCount={filteredItems.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSearch={handleSearch}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleSidebar={() => setSidebarOpen(true)}
          filterStatus={filterStatus}
          filterTypes={filterTypes}
          onFilterStatusChange={setFilterStatus}
          onFilterTypesChange={setFilterTypes}
        />

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">No items yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first link or note to get started
              </p>
              <Button
                className="mt-4 gap-2"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add your first item
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  viewMode="grid"
                  onMarkRead={handleMarkRead}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onMoveToFolder={() => {}}
                  onAddTag={() => {}}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  viewMode="list"
                  onMarkRead={handleMarkRead}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onMoveToFolder={() => {}}
                  onAddTag={() => {}}
                />
              ))}
            </div>
          )}
        </main>

        {/* Floating Add Button */}
        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg glow md:hidden"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Dialogs */}
      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAddItem={handleAddItem}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onAddItem={() => setAddDialogOpen(true)}
        items={items}
        folders={folders}
        tags={tags}
      />

      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onCreateFolder={handleCreateFolder}
      />

      <CreateTagDialog
        open={createTagOpen}
        onOpenChange={setCreateTagOpen}
        onCreateTag={handleCreateTag}
      />
    </div>
  )
}
