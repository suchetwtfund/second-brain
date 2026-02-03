import { createClient } from '@/lib/supabase/server'
import { DashboardWrapper } from '@/components/dashboard-wrapper'

export default async function Home() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null // Middleware will redirect
  }

  // Fetch user's data
  const [{ data: items }, { data: folders }, { data: tags }] = await Promise.all([
    supabase
      .from('items')
      .select('*')
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
      userEmail={user.email || ''}
    />
  )
}
