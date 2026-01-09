-- Activity Reactions Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS activity_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES activity_log(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('heart', 'thumbs_up', 'interrobang')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(activity_id, user_id, reaction)
);

ALTER TABLE activity_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select" ON activity_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON activity_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete" ON activity_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_reactions_activity ON activity_reactions(activity_id);

-- Activity Comments Table
CREATE TABLE IF NOT EXISTS activity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES activity_log(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) <= 280),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON activity_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON activity_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON activity_comments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_comments_activity ON activity_comments(activity_id);

-- Enable realtime for both
ALTER PUBLICATION supabase_realtime ADD TABLE activity_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_comments;
