import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GroupPageClient } from './group-page-client'

interface GroupPageProps {
  params: Promise<{ id: string }>
}

export default async function GroupPage({ params }: GroupPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch group with members
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select(`
      *,
      group_members (
        user_id,
        role,
        joined_at,
        profiles:user_id (
          id,
          email,
          display_name,
          avatar_url
        )
      )
    `)
    .eq('id', id)
    .single()

  console.log('Group fetch result:', { group, groupError, id })

  if (groupError || !group) {
    console.log('Redirecting: groupError or no group', { groupError, group })
    redirect('/')
  }

  // Check if user is a member
  let userMembership = group.group_members.find(
    (m: { user_id: string }) => m.user_id === user.id
  )

  console.log('User membership check:', {
    userId: user.id,
    groupOwnerId: group.owner_id,
    groupMembers: group.group_members,
    userMembership
  })

  // If user is the owner but not in members, auto-fix by creating membership
  if (!userMembership && group.owner_id === user.id) {
    console.log('Owner missing from members, auto-creating membership...')
    const { error: fixError } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
        role: 'owner'
      })

    if (!fixError) {
      // Refetch group with updated members
      const { data: refreshedGroup } = await supabase
        .from('groups')
        .select(`
          *,
          group_members (
            user_id,
            role,
            joined_at,
            profiles:user_id (
              id,
              email,
              display_name,
              avatar_url
            )
          )
        `)
        .eq('id', id)
        .single()

      if (refreshedGroup) {
        Object.assign(group, refreshedGroup)
        userMembership = refreshedGroup.group_members.find(
          (m: { user_id: string }) => m.user_id === user.id
        )
      }
    } else {
      console.log('Failed to auto-create membership:', fixError)
    }
  }

  if (!userMembership) {
    console.log('Redirecting: no userMembership and not owner')
    redirect('/')
  }

  // Fetch shared items
  const { data: sharedItems } = await supabase
    .from('shared_items')
    .select(`
      id,
      note,
      created_at,
      item:item_id (
        id,
        type,
        url,
        title,
        description,
        thumbnail,
        content,
        status,
        content_type,
        created_at,
        word_count,
        reading_time_minutes
      ),
      sharer:shared_by (
        id,
        email,
        display_name,
        avatar_url
      )
    `)
    .eq('group_id', id)
    .order('created_at', { ascending: false })

  // Fetch user's groups for sidebar
  const { data: userGroups } = await supabase
    .from('groups')
    .select(`
      *,
      group_members!inner (
        user_id,
        role
      )
    `)
    .eq('group_members.user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch folders and tags for navigation
  const [{ data: folders }, { data: tags }] = await Promise.all([
    supabase.from('folders').select('*').order('name'),
    supabase.from('tags').select('*').order('name'),
  ])

  // Count pending invitations
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single()

  let pendingInvitationsCount = 0
  if (profile) {
    const { count } = await supabase
      .from('group_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('email', profile.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    pendingInvitationsCount = count || 0
  }

  const members = group.group_members.map((m: { profiles: object; role: string; joined_at: string }) => ({
    ...m.profiles,
    role: m.role,
    joined_at: m.joined_at
  }))

  const groupsWithRole = (userGroups || []).map(g => ({
    ...g,
    userRole: g.group_members[0]?.role || 'member',
    group_members: undefined
  }))

  // Transform shared items to match expected types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformedSharedItems = (sharedItems || []).map((si: any) => ({
    id: si.id,
    note: si.note,
    created_at: si.created_at,
    item: si.item,
    sharer: si.sharer
  }))

  return (
    <GroupPageClient
      group={{ ...group, group_members: undefined }}
      members={members}
      userRole={userMembership.role}
      sharedItems={transformedSharedItems}
      groups={groupsWithRole}
      folders={folders || []}
      tags={tags || []}
      userId={user.id}
      userEmail={user.email || ''}
      pendingInvitationsCount={pendingInvitationsCount}
    />
  )
}
