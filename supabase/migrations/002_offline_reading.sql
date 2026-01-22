-- Migration: Add offline reading metadata fields to items table
-- This enables the Instapaper-style offline reading feature

ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS content_extracted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS word_count integer,
ADD COLUMN IF NOT EXISTS reading_time_minutes integer;

-- Add index for faster queries on items with extracted content
CREATE INDEX IF NOT EXISTS idx_items_content_extracted
ON public.items (content_extracted_at)
WHERE content_extracted_at IS NOT NULL;

-- Comment on new columns for documentation
COMMENT ON COLUMN public.items.content_extracted_at IS 'Timestamp when article content was extracted using Readability';
COMMENT ON COLUMN public.items.word_count IS 'Number of words in the extracted article content';
COMMENT ON COLUMN public.items.reading_time_minutes IS 'Estimated reading time in minutes (based on 200 wpm)';
