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
          content_extracted_at: string | null
          word_count: number | null
          reading_time_minutes: number | null
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
          content_extracted_at?: string | null
          word_count?: number | null
          reading_time_minutes?: number | null
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
          content_extracted_at?: string | null
          word_count?: number | null
          reading_time_minutes?: number | null
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
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          created_at?: string
        }
      }
      group_members: {
        Row: {
          group_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          joined_at: string
        }
        Insert: {
          group_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
        Update: {
          group_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
      }
      group_invitations: {
        Row: {
          id: string
          group_id: string
          email: string
          invited_by: string
          status: 'pending' | 'accepted' | 'declined'
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          group_id: string
          email: string
          invited_by: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          email?: string
          invited_by?: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
          expires_at?: string
        }
      }
      shared_items: {
        Row: {
          id: string
          item_id: string
          group_id: string
          shared_by: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          group_id: string
          shared_by: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          group_id?: string
          shared_by?: string
          note?: string | null
          created_at?: string
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

// Social types
export type Profile = Tables<'profiles'>
export type Group = Tables<'groups'>
export type GroupMember = Tables<'group_members'>
export type GroupInvitation = Tables<'group_invitations'>
export type SharedItem = Tables<'shared_items'>
export type GroupRole = 'owner' | 'admin' | 'member'
export type InvitationStatus = 'pending' | 'accepted' | 'declined'

// Extended types with relations
export type GroupWithMembers = Group & {
  members: (GroupMember & { profile: Profile })[]
}

export type SharedItemWithDetails = SharedItem & {
  item: Item
  sharer: Profile
}

export type GroupInvitationWithGroup = GroupInvitation & {
  group: Group
  inviter: Profile
}
