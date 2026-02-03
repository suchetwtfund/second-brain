import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/groups - List user's groups
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all groups where user is a member
    const { data: groups, error } = await supabase
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

    if (error) {
      console.error('Error fetching groups:', error)
      return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
    }

    // Add user's role to each group
    const groupsWithRole = groups.map(group => ({
      ...group,
      userRole: group.group_members[0]?.role || 'member',
      group_members: undefined
    }))

    return NextResponse.json({ groups: groupsWithRole })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/groups - Create a new group
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    // Create the group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        owner_id: user.id
      })
      .select()
      .single()

    if (groupError) {
      console.error('Error creating group:', groupError)
      return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
    }

    // Add creator as owner member
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
        role: 'owner'
      })

    if (memberError) {
      console.error('Error adding owner as member:', memberError)
      // Try to clean up the group
      await supabase.from('groups').delete().eq('id', group.id)
      return NextResponse.json({ error: 'Failed to create group membership' }, { status: 500 })
    }

    return NextResponse.json({ group: { ...group, userRole: 'owner' } }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
