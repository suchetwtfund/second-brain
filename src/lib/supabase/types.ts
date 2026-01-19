export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      folders: {
        Row: {
          id: string
          user_id: string
          name: string
          parent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          parent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          parent_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      items: {
        Row: {
          id: string
          user_id: string
          type: 'link' | 'note' | 'pdf'
          url: string | null
          title: string
          description: string | null
          thumbnail: string | null
          content: string | null
          folder_id: string | null
          status: 'unread' | 'read' | 'archived'
          content_type: 'video' | 'article' | 'tweet' | 'link' | 'note' | 'pdf' | 'spotify'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'link' | 'note' | 'pdf'
          url?: string | null
          title: string
          description?: string | null
          thumbnail?: string | null
          content?: string | null
          folder_id?: string | null
          status?: 'unread' | 'read' | 'archived'
          content_type?: 'video' | 'article' | 'tweet' | 'link' | 'note' | 'pdf'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'link' | 'note' | 'pdf'
          url?: string | null
          title?: string
          description?: string | null
          thumbnail?: string | null
          content?: string | null
          folder_id?: string | null
          status?: 'unread' | 'read' | 'archived'
          content_type?: 'video' | 'article' | 'tweet' | 'link' | 'note' | 'pdf'
          created_at?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          created_at?: string
        }
      }
      item_tags: {
        Row: {
          item_id: string
          tag_id: string
        }
        Insert: {
          item_id: string
          tag_id: string
        }
        Update: {
          item_id?: string
          tag_id?: string
        }
      }
      highlights: {
        Row: {
          id: string
          item_id: string
          user_id: string
          text: string
          color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange'
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          item_id: string
          user_id: string
          text: string
          color?: 'yellow' | 'green' | 'blue' | 'pink' | 'orange'
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          user_id?: string
          text?: string
          color?: 'yellow' | 'green' | 'blue' | 'pink' | 'orange'
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Convenience types
export type Folder = Tables<'folders'>
export type Item = Tables<'items'>
export type Tag = Tables<'tags'>
export type ItemTag = Tables<'item_tags'>
export type Highlight = Tables<'highlights'>
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'
