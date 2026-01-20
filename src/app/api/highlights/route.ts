import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create admin client for Bearer token auth (used by extension)
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Helper to get authenticated user from either cookies or Bearer token
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  // Try Bearer token first (used by extension)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (!error && user) {
      return { user, supabase: supabaseAdmin }
    }
  }

  // Fall back to cookie-based auth (used by web app)
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!error && user) {
    return { user, supabase }
  }

  return null
}

// POST - Create highlight (with optional auto-save item)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth
    const body = await request.json()
    const { url, title, text, color = 'yellow', item_id } = body

    if (!text) {
      return NextResponse.json(
        { error: 'Highlighted text is required' },
        { status: 400 }
      )
    }

    let targetItemId = item_id

    // If no item_id provided, we need to find or create the item
    if (!targetItemId) {
      if (!url) {
        return NextResponse.json(
          { error: 'URL is required when item_id is not provided' },
          { status: 400 }
        )
      }

      // Check if item with this URL already exists for this user
      const { data: existingItem } = await supabase
        .from('items')
        .select('id')
        .eq('user_id', user.id)
        .eq('url', url)
        .single()

      if (existingItem) {
        targetItemId = existingItem.id
      } else {
        // Fetch metadata and create the item
        let itemTitle = title || url
        let itemDescription: string | undefined
        let itemThumbnail: string | undefined
        let itemContentType = 'link'

        try {
          const metadataUrl = new URL('/api/metadata', request.url)
          metadataUrl.searchParams.set('url', url)

          const metadataResponse = await fetch(metadataUrl.toString())
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json()
            itemTitle = title || metadata.title || url
            itemDescription = metadata.description
            itemThumbnail = metadata.thumbnail
            itemContentType = metadata.contentType || 'link'
          }
        } catch {
          // Use defaults if metadata fetch fails
        }

        // Create the item
        const { data: newItem, error: itemError } = await supabase
          .from('items')
          .insert({
            user_id: user.id,
            type: 'link',
            url,
            title: itemTitle,
            description: itemDescription,
            thumbnail: itemThumbnail,
            content_type: itemContentType,
            status: 'unread',
          })
          .select()
          .single()

        if (itemError) {
          console.error('Item insert error:', itemError)
          return NextResponse.json(
            { error: 'Failed to save item' },
            { status: 500 }
          )
        }

        targetItemId = newItem.id
      }
    }

    // Create the highlight
    const { data: highlight, error: highlightError } = await supabase
      .from('highlights')
      .insert({
        item_id: targetItemId,
        user_id: user.id,
        text,
        color,
      })
      .select()
      .single()

    if (highlightError) {
      console.error('Highlight insert error:', highlightError)
      return NextResponse.json(
        { error: 'Failed to save highlight' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, highlight, item_id: targetItemId })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - List highlights for an item (by item_id or url)
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('item_id')
    const url = searchParams.get('url')

    // Support fetching by URL (for extension side panel)
    if (url) {
      // First find the item by URL
      const { data: item } = await supabase
        .from('items')
        .select('id')
        .eq('user_id', user.id)
        .eq('url', url)
        .single()

      if (!item) {
        // No item for this URL, return empty highlights
        return NextResponse.json({ highlights: [] })
      }

      const { data: highlights, error } = await supabase
        .from('highlights')
        .select('*')
        .eq('item_id', item.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Fetch highlights error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch highlights' },
          { status: 500 }
        )
      }

      return NextResponse.json({ highlights })
    }

    // Original behavior: fetch by item_id
    if (!itemId) {
      return NextResponse.json(
        { error: 'item_id or url query parameter is required' },
        { status: 400 }
      )
    }

    const { data: highlights, error } = await supabase
      .from('highlights')
      .select('*')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch highlights error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch highlights' },
        { status: 500 }
      )
    }

    return NextResponse.json({ highlights })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
