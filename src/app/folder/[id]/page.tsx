import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'

interface FolderPageProps {
  params: Promise<{ id: string }>
}

export default async function FolderPage({ params }: FolderPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get the folder
  const { data: folder } = await supabase
    .from('folders')
    .select('*')
    .eq('id', id)
    .single()

  if (!folder) {
    redirect('/')
  }

  // Fetch items in this folder
  const [{ data: items }, { data: folders }, { data: tags }] = await Promise.all([
    supabase
      .from('items')
      .select('*')
      .eq('folder_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('folders')
      .select('*')
      .order('name'),
    supabase
      .from('tags')
      .select('*')
      .order('name'),
  ])

  return (
    <DashboardWrapper
      initialItems={items || []}
      initialFolders={folders || []}
      initialTags={tags || []}
      userId={user.id}
      currentFolder={folder}
    />
  )
}
