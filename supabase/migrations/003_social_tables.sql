-- Migration: Add social layer tables for groups and sharing
-- Enables team collaboration features: groups, invitations, and shared items

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PHASE 1: CREATE ALL TABLES FIRST
-- ============================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.profiles IS 'User profiles for social features, auto-created when users sign up';

-- 2. GROUPS TABLE
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.groups IS 'Team/group definitions for shared newsboards';

-- 3. GROUP_MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

COMMENT ON TABLE public.group_members IS 'Group membership tracking with roles (owner, admin, member)';

CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- 4. GROUP_INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS public.group_invitations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days') NOT NULL,
  UNIQUE(group_id, email)
);

COMMENT ON TABLE public.group_invitations IS 'Pending group invitations by email with expiration';

CREATE INDEX IF NOT EXISTS idx_group_invitations_email ON public.group_invitations(email);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON public.group_invitations(status) WHERE status = 'pending';

-- 5. SHARED_ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.shared_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id uuid REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  shared_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(item_id, group_id)
);

COMMENT ON TABLE public.shared_items IS 'Items shared to groups - stores references, not copies';

CREATE INDEX IF NOT EXISTS idx_shared_items_group_id ON public.shared_items(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_items_item_id ON public.shared_items(item_id);
CREATE INDEX IF NOT EXISTS idx_shared_items_created_at ON public.shared_items(created_at DESC);

-- ============================================
-- PHASE 2: ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PHASE 3: CREATE ALL RLS POLICIES
-- ============================================

-- PROFILES POLICIES
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- GROUPS POLICIES
CREATE POLICY "Groups are viewable by members"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their groups"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their groups"
  ON public.groups FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- GROUP_MEMBERS POLICIES
CREATE POLICY "Group members are viewable by group members"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members AS gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can add members"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members AS gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
    ) OR
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can remove members"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.group_members AS gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can update member roles"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members AS gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members AS gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
    )
  );

-- GROUP_INVITATIONS POLICIES
CREATE POLICY "Invitations are viewable by invitee and group admins"
  ON public.group_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = group_invitations.email
    ) OR
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_invitations.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can create invitations"
  ON public.group_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_invitations.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Invitees can update invitation status"
  ON public.group_invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = group_invitations.email
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = group_invitations.email
    )
  );

CREATE POLICY "Admins can delete invitations"
  ON public.group_invitations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_invitations.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role IN ('owner', 'admin')
    )
  );

-- SHARED_ITEMS POLICIES
CREATE POLICY "Shared items are viewable by group members"
  ON public.shared_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = shared_items.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can share their own items"
  ON public.shared_items FOR INSERT
  TO authenticated
  WITH CHECK (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = shared_items.group_id
      AND group_members.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = shared_items.item_id
      AND items.user_id = auth.uid()
    )
  );

CREATE POLICY "Sharers can update their shared items"
  ON public.shared_items FOR UPDATE
  TO authenticated
  USING (shared_by = auth.uid())
  WITH CHECK (shared_by = auth.uid());

CREATE POLICY "Sharers and admins can delete shared items"
  ON public.shared_items FOR DELETE
  TO authenticated
  USING (
    shared_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = shared_items.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- PHASE 4: UPDATE ITEMS TABLE RLS
-- ============================================

-- Policy to allow group members to view shared items
CREATE POLICY "Group members can view shared items"
  ON public.items FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.shared_items si
      JOIN public.group_members gm ON gm.group_id = si.group_id
      WHERE si.item_id = items.id
      AND gm.user_id = auth.uid()
    )
  );

-- ============================================
-- PHASE 5: CREATE TRIGGER FOR AUTO-PROFILE
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PHASE 6: BACKFILL EXISTING USERS
-- ============================================

INSERT INTO public.profiles (id, email, display_name)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id
)
ON CONFLICT (id) DO NOTHING;
