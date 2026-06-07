/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Creates indexes for all unindexed foreign key columns
    - Improves query performance for JOIN operations
    - Reduces query execution time for lookups

  2. Indexed Tables
    - analytics_events (contest_id, user_id)
    - contest_member_exits (participant_id)
    - contest_participants (assigned_by)
    - contest_teams (captain_id)
    - metric_submissions (approved_by)
    - prize_contributions (contest_id, user_id)
    - submissions (reviewed_by)
    - template_purchases (buyer_id, template_id)
    - templates (creator_id)
*/

-- analytics_events indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_contest_id 
  ON analytics_events(contest_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id 
  ON analytics_events(user_id);

-- contest_member_exits indexes
CREATE INDEX IF NOT EXISTS idx_contest_member_exits_participant_id_fk 
  ON contest_member_exits(participant_id);

-- contest_participants indexes
CREATE INDEX IF NOT EXISTS idx_contest_participants_assigned_by 
  ON contest_participants(assigned_by);

-- contest_teams indexes
CREATE INDEX IF NOT EXISTS idx_contest_teams_captain_id 
  ON contest_teams(captain_id);

-- metric_submissions indexes
CREATE INDEX IF NOT EXISTS idx_metric_submissions_approved_by 
  ON metric_submissions(approved_by);

-- prize_contributions indexes
CREATE INDEX IF NOT EXISTS idx_prize_contributions_contest_id_fk 
  ON prize_contributions(contest_id);

CREATE INDEX IF NOT EXISTS idx_prize_contributions_user_id_fk 
  ON prize_contributions(user_id);

-- submissions indexes
CREATE INDEX IF NOT EXISTS idx_submissions_reviewed_by 
  ON submissions(reviewed_by);

-- template_purchases indexes
CREATE INDEX IF NOT EXISTS idx_template_purchases_buyer_id 
  ON template_purchases(buyer_id);

CREATE INDEX IF NOT EXISTS idx_template_purchases_template_id 
  ON template_purchases(template_id);

-- templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_creator_id 
  ON templates(creator_id);