import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { url, title, description, thumbnail, content_type } = body

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // If metadata not provided, fetch it
    let itemTitle = title
    let itemDescription = description
    let itemThumbnail = thumbnail
    let itemContentType = content_type

    if (!title) {
      // Fetch metadata from our existing endpoint
      const metadataUrl = new URL('/api/metadata', request.url)
      metadataUrl.searchParams.set('url', url)

      const metadataResponse = await fetch(metadataUrl.toString())
      if (metadataResponse.ok) {
        const metadata = await metadataResponse.json()
        itemTitle = metadata.title || url
        itemDescription = metadata.description
        itemThumbnail = metadata.thumbnail
        itemContentType = metadata.contentType
      } else {
        itemTitle = url
        itemContentType = 'link'
      }
    }

    // Insert the item
    const { data, error } = await supabase
      .from('items')
      .insert({
        user_id: user.id,
        type: 'link',
        url,
        title: itemTitle,
        description: itemDescription,
        thumbnail: itemThumbnail,
        content_type: itemContentType || 'link',
        status: 'unread',
      })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save item' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, item: data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
