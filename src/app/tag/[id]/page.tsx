import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'

interface TagPageProps {
  params: Promise<{ id: string }>
}

export default async function TagPage({ params }: TagPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get the tag
  const { data: tag } = await supabase
    .from('tags')
    .select('*')
    .eq('id', id)
    .single()

  if (!tag) {
    redirect('/')
  }

  // Get item IDs that have this tag
  const { data: itemTags } = await supabase
    .from('item_tags')
    .select('item_id')
    .eq('tag_id', id)

  const itemIds = itemTags?.map(it => it.item_id) || []

  // Fetch items with this tag
  let items: any[] = []
  if (itemIds.length > 0) {
    const { data } = await supabase
      .from('items')
      .select('*')
      .in('id', itemIds)
      .order('created_at', { ascending: false })
    items = data || []
  }

  // Fetch all folders and tags for sidebar
  const [{ data: folders }, { data: tags }] = await Promise.all([
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
      initialItems={items}
      initialFolders={folders || []}
      initialTags={tags || []}
      userId={user.id}
      currentTag={tag}
    />
  )
}
