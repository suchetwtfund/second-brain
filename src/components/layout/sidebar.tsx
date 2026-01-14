'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Home,
  FolderOpen,
  Tag,
  Plus,
  ChevronRight,
  Settings,
  LogOut,
} from 'lucide-react'
import type { Folder, Tag as TagType } from '@/lib/supabase/types'

interface SidebarProps {
  folders: Folder[]
  tags: TagType[]
  onSignOut: () => void
  onCreateFolder: () => void
  onCreateTag: () => void
  onAddItem: () => void
  onOpenSettings: () => void
}

const navItems = [
  { href: '/', label: 'All Items', icon: Home },
]

export function Sidebar({ folders, tags, onSignOut, onCreateFolder, onCreateTag, onAddItem, onOpenSettings }: SidebarProps) {
  const pathname = usePathname()
  const [foldersExpanded, setFoldersExpanded] = useState(true)
  const [tagsExpanded, setTagsExpanded] = useState(true)

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-8 w-8 items-center justify-center">
          <img src="/telos-logo.png" alt="Telos" className="h-8 w-8 object-contain" />
        </div>
        <span className="text-lg font-semibold">Telos</span>
      </div>

      <Separator className="bg-sidebar-border" />

      <ScrollArea className="flex-1 px-3 py-4">
        {/* Quick Add Button */}
        <Button className="mb-4 w-full justify-start gap-2 glow-sm" size="sm" onClick={onAddItem}>
          <Plus className="h-4 w-4" />
          Add New
        </Button>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <Separator className="my-4 bg-sidebar-border" />

        {/* Folders */}
        <div className="space-y-1">
          <button
            onClick={() => setFoldersExpanded(!foldersExpanded)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5" />
              Folders
            </span>
            <ChevronRight
              className={cn('h-3.5 w-3.5 transition-transform', foldersExpanded && 'rotate-90')}
            />
          </button>

          {foldersExpanded && (
            <div className="ml-2 space-y-1">
              {folders.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No folders yet</p>
              ) : (
                folders.map((folder) => (
                  <Link
                    key={folder.id}
                    href={`/folder/${folder.id}`}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                      pathname === `/folder/${folder.id}`
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {folder.name}
                  </Link>
                ))
              )}
              <button
                onClick={onCreateFolder}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                New folder
              </button>
            </div>
          )}
        </div>

        <Separator className="my-4 bg-sidebar-border" />

        {/* Tags */}
        <div className="space-y-1">
          <button
            onClick={() => setTagsExpanded(!tagsExpanded)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5" />
              Tags
            </span>
            <ChevronRight
              className={cn('h-3.5 w-3.5 transition-transform', tagsExpanded && 'rotate-90')}
            />
          </button>

          {tagsExpanded && (
            <div className="ml-2 space-y-1">
              {tags.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No tags yet</p>
              ) : (
                tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tag/${tag.id}`}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                      pathname === `/tag/${tag.id}`
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </Link>
                ))
              )}
              <button
                onClick={onCreateTag}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                New tag
              </button>
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* Footer */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={onOpenSettings}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
