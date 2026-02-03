import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

// DELETE /api/shared/[id] - Unshare item from group
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: sharedItemId } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the shared item
    const { data: sharedItem, error: fetchError } = await supabase
      .from('shared_items')
      .select('id, shared_by, group_id')
      .eq('id', sharedItemId)
      .single()

    if (fetchError || !sharedItem) {
      return NextResponse.json({ error: 'Shared item not found' }, { status: 404 })
    }

    // Check if user is the sharer or a group admin
    const isSharer = sharedItem.shared_by === user.id

    if (!isSharer) {
      const { data: membership } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', sharedItem.group_id)
        .eq('user_id', user.id)
        .single()

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return NextResponse.json({ error: 'Only the sharer or group admins can unshare items' }, { status: 403 })
      }
    }

    const { error: deleteError } = await supabase
      .from('shared_items')
      .delete()
      .eq('id', sharedItemId)

    if (deleteError) {
      console.error('Error deleting shared item:', deleteError)
      return NextResponse.json({ error: 'Failed to unshare item' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/shared/[id] - Update shared item note
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: sharedItemId } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the shared item
    const { data: sharedItem, error: fetchError } = await supabase
      .from('shared_items')
      .select('id, shared_by')
      .eq('id', sharedItemId)
      .single()

    if (fetchError || !sharedItem) {
      return NextResponse.json({ error: 'Shared item not found' }, { status: 404 })
    }

    // Only the sharer can update the note
    if (sharedItem.shared_by !== user.id) {
      return NextResponse.json({ error: 'Only the sharer can update the note' }, { status: 403 })
    }

    const body = await request.json()
    const { note } = body

    const { data: updated, error: updateError } = await supabase
      .from('shared_items')
      .update({ note: note?.trim() || null })
      .eq('id', sharedItemId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating shared item:', updateError)
      return NextResponse.json({ error: 'Failed to update shared item' }, { status: 500 })
    }

    return NextResponse.json({ sharedItem: updated })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
