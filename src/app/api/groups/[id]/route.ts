import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/groups/[id] - Get group with members
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get group with members and their profiles
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

    if (groupError) {
      if (groupError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 })
      }
      console.error('Error fetching group:', groupError)
      return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 })
    }

    // Find user's role in the group
    const userMembership = group.group_members.find(
      (m: { user_id: string }) => m.user_id === user.id
    )

    if (!userMembership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    return NextResponse.json({
      group: {
        ...group,
        userRole: userMembership.role,
        members: group.group_members.map((m: { profiles: Record<string, unknown> | null; user_id: string; role: string; joined_at: string }) => ({
          ...(m.profiles || {}),
          role: m.role,
          joined_at: m.joined_at
        }))
      }
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/groups/[id] - Update group
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is owner or admin
    const { data: membership, error: memberError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', id)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can update groups' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description } = body

    const updates: { name?: string; description?: string | null } = {}
    if (name !== undefined) updates.name = name.trim()
    if (description !== undefined) updates.description = description?.trim() || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data: group, error: updateError } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating group:', updateError)
      return NextResponse.json({ error: 'Failed to update group' }, { status: 500 })
    }

    return NextResponse.json({ group })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/groups/[id] - Delete group
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is the owner
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', id)
      .single()

    if (groupError) {
      if (groupError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 })
      }
      console.error('Error fetching group:', groupError)
      return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 })
    }

    if (group.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only the owner can delete a group' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting group:', deleteError)
      return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
