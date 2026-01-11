'use client'

import dynamic from 'next/dynamic'
import type { Item, Folder, Tag } from '@/lib/supabase/types'

const Dashboard = dynamic(
  () => import('@/components/dashboard').then((mod) => mod.Dashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your brain...</p>
        </div>
      </div>
    ),
  }
)

interface DashboardWrapperProps {
  initialItems: Item[]
  initialFolders: Folder[]
  initialTags: Tag[]
  userId: string
  currentFolder?: Folder
  currentTag?: Tag
}

export function DashboardWrapper(props: DashboardWrapperProps) {
  return <Dashboard {...props} />
}
