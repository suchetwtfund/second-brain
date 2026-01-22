import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify'

// Force Node.js runtime (required for jsdom)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WORDS_PER_MINUTE = 200

function calculateReadingTime(text: string): { wordCount: number; readingTimeMinutes: number } {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0)
  const wordCount = words.length
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE))
  return { wordCount, readingTimeMinutes }
}

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
    const { itemId } = body

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    // Fetch the item
    const { data: item, error: fetchError } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    // Check if content already extracted
    if (item.content && item.content_extracted_at) {
      return NextResponse.json({
        success: true,
        item,
        message: 'Content already extracted'
      })
    }

    if (!item.url) {
      return NextResponse.json(
        { error: 'Item has no URL to extract content from' },
        { status: 400 }
      )
    }

    // Fetch the URL content
    const response = await fetch(item.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Telos/1.0; +https://telos.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: 502 }
      )
    }

    const html = await response.text()

    // Parse with JSDOM and extract with Readability
    const dom = new JSDOM(html, { url: item.url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    if (!article) {
      return NextResponse.json(
        { error: 'Could not extract article content' },
        { status: 422 }
      )
    }

    // Create a JSDOM window for DOMPurify
    const purifyWindow = new JSDOM('').window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const purify = DOMPurify(purifyWindow as any)

    // Sanitize the HTML content
    const sanitizedContent = purify.sanitize(article.content || '', {
      ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
                     'blockquote', 'pre', 'code', 'em', 'strong', 'a', 'img', 'figure',
                     'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
    })

    // Calculate reading stats from text content
    const { wordCount, readingTimeMinutes } = calculateReadingTime(article.textContent || '')

    // Update the item with extracted content
    // Try with all fields first, fall back to just content if new columns don't exist
    let updatedItem = null
    let updateError = null

    // First try with all fields
    const fullUpdate = await supabase
      .from('items')
      .update({
        content: sanitizedContent,
        content_extracted_at: new Date().toISOString(),
        word_count: wordCount,
        reading_time_minutes: readingTimeMinutes,
        title: article.title || item.title,
      })
      .eq('id', itemId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (fullUpdate.error) {
      console.error('Full update failed, trying minimal update:', fullUpdate.error.message)
      // Fall back to just updating content (original column)
      const minimalUpdate = await supabase
        .from('items')
        .update({
          content: sanitizedContent,
          title: article.title || item.title,
        })
        .eq('id', itemId)
        .eq('user_id', user.id)
        .select()
        .single()

      updatedItem = minimalUpdate.data
      updateError = minimalUpdate.error

      // Add the computed fields to the response even if not saved to DB
      if (updatedItem) {
        updatedItem = {
          ...updatedItem,
          word_count: wordCount,
          reading_time_minutes: readingTimeMinutes,
        }
      }
    } else {
      updatedItem = fullUpdate.data
    }

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: `Failed to save extracted content: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
      stats: {
        wordCount,
        readingTimeMinutes,
        title: article.title,
        byline: article.byline,
        excerpt: article.excerpt,
      }
    })
  } catch (error) {
    console.error('Content extraction error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
