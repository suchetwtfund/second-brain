import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/invitations/[id] - Accept or decline invitation
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: invitationId } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "accept" or "decline"' }, { status: 400 })
    }

    // Get user's email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('group_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('email', profile.email)
      .eq('status', 'pending')
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found or not addressed to you' }, { status: 404 })
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 })
    }

    if (action === 'accept') {
      // Check if user is already a member
      const { data: existing } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', invitation.group_id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        // Update invitation status anyway
        await supabase
          .from('group_invitations')
          .update({ status: 'accepted' })
          .eq('id', invitationId)

        return NextResponse.json({ error: 'You are already a member of this group' }, { status: 409 })
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: invitation.group_id,
          user_id: user.id,
          role: 'member'
        })

      if (memberError) {
        console.error('Error adding member:', memberError)
        return NextResponse.json({ error: 'Failed to join group' }, { status: 500 })
      }

      // Update invitation status
      await supabase
        .from('group_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId)

      // Get the group info
      const { data: group } = await supabase
        .from('groups')
        .select('id, name')
        .eq('id', invitation.group_id)
        .single()

      return NextResponse.json({
        success: true,
        message: `You have joined ${group?.name || 'the group'}`,
        group
      })
    } else {
      // Decline
      await supabase
        .from('group_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId)

      return NextResponse.json({ success: true, message: 'Invitation declined' })
    }
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/invitations/[id] - Cancel/delete invitation (by admin)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: invitationId } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('group_invitations')
      .select('group_id')
      .eq('id', invitationId)
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Check if user is admin/owner of the group
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', invitation.group_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only group admins can cancel invitations' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('group_invitations')
      .delete()
      .eq('id', invitationId)

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError)
      return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
