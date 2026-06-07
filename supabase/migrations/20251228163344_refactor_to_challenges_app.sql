/*
  # Refactor to Challenges App

  1. New Tables
    - `challenge_templates`
      - `id` (uuid, primary key)
      - `name` (text) - Template name (e.g., "10K Steps Daily")
      - `description` (text) - Template description
      - `category` (text) - fitness, health, productivity, mindfulness, custom
      - `default_metrics` (jsonb) - Array of default metrics with names and units
      - `suggested_duration_days` (integer) - Suggested challenge duration
      - `icon` (text) - Icon identifier
      - `created_at` (timestamptz)
  
  2. Modified Tables
    - `submissions` - Remove approval workflow columns
      - Drop `approved_by`, `rejected_by`, `rejection_reason`
      - Drop `approved_at`, `rejected_at`
      - Add `streak_count` (integer) - Current streak for this submission
    
  3. Removed Tables
    - Drop `teams` table (no longer needed)
    - Drop `team_members` table (no longer needed)
    - Drop `contest_evidence` table (no longer needed)

  4. Security
    - Enable RLS on `challenge_templates` table
    - Add policies for public read access to templates
    - Update existing policies to reflect simplified model

  5. Important Notes
    - All contests are now private by default (no discovery)
    - Simplified to creator + admin roles (WhatsApp style)
    - Focus on daily metric tracking and streaks
    - Removed approval workflow entirely
*/

-- Create challenge templates table
CREATE TABLE IF NOT EXISTS challenge_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  default_metrics jsonb NOT NULL DEFAULT '[]',
  suggested_duration_days integer DEFAULT 30,
  icon text DEFAULT 'target',
  created_at timestamptz DEFAULT now()
);

-- Add streak tracking to submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'streak_count'
  ) THEN
    ALTER TABLE submissions ADD COLUMN streak_count integer DEFAULT 0;
  END IF;
END $$;

-- Remove approval workflow columns from submissions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE submissions DROP COLUMN IF EXISTS approved_by;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'rejected_by'
  ) THEN
    ALTER TABLE submissions DROP COLUMN IF EXISTS rejected_by;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE submissions DROP COLUMN IF EXISTS rejection_reason;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE submissions DROP COLUMN IF EXISTS approved_at;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE submissions DROP COLUMN IF EXISTS rejected_at;
  END IF;
END $$;

-- Drop teams tables (no longer needed)
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Drop evidence table (no longer needed)
DROP TABLE IF EXISTS contest_evidence CASCADE;

-- Enable RLS on challenge_templates
ALTER TABLE challenge_templates ENABLE ROW LEVEL SECURITY;

-- Public read access to templates
CREATE POLICY "Anyone can view challenge templates"
  ON challenge_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert preset challenge templates
INSERT INTO challenge_templates (name, description, category, default_metrics, suggested_duration_days, icon)
VALUES 
  (
    '10K Steps Daily',
    'Walk 10,000 steps every day to improve cardiovascular health and build a consistent movement habit',
    'fitness',
    '[{"name": "Steps", "unit": "steps"}]'::jsonb,
    30,
    'footprints'
  ),
  (
    '50 Pushups Daily',
    'Build upper body strength with 50 pushups each day (can be broken into sets)',
    'fitness',
    '[{"name": "Pushups", "unit": "reps"}]'::jsonb,
    30,
    'dumbbell'
  ),
  (
    '10 Minutes Meditation',
    'Practice mindfulness with 10 minutes of meditation daily to reduce stress and improve focus',
    'mindfulness',
    '[{"name": "Minutes", "unit": "min"}]'::jsonb,
    21,
    'brain'
  ),
  (
    '8 Hours Sleep',
    'Prioritize rest and recovery with 8 hours of quality sleep each night',
    'health',
    '[{"name": "Hours", "unit": "hrs"}]'::jsonb,
    30,
    'moon'
  ),
  (
    '2L Water Daily',
    'Stay hydrated by drinking 2 liters of water throughout the day',
    'health',
    '[{"name": "Water", "unit": "L"}]'::jsonb,
    30,
    'droplet'
  ),
  (
    '30 Min Reading',
    'Develop a reading habit with 30 minutes of focused reading each day',
    'productivity',
    '[{"name": "Minutes", "unit": "min"}]'::jsonb,
    30,
    'book-open'
  ),
  (
    'No Social Media',
    'Track days without using social media to improve focus and mental clarity',
    'productivity',
    '[{"name": "Hours Avoided", "unit": "hrs"}]'::jsonb,
    14,
    'smartphone'
  ),
  (
    '5K Run',
    'Run 5 kilometers to build endurance and cardiovascular fitness',
    'fitness',
    '[{"name": "Distance", "unit": "km"}, {"name": "Time", "unit": "min"}]'::jsonb,
    60,
    'activity'
  ),
  (
    'Gratitude Journal',
    'Write down 3 things you''re grateful for each day to cultivate positivity',
    'mindfulness',
    '[{"name": "Entries", "unit": "count"}]'::jsonb,
    21,
    'heart'
  ),
  (
    'Custom Challenge',
    'Create your own challenge with custom metrics and goals',
    'custom',
    '[]'::jsonb,
    30,
    'target'
  )
ON CONFLICT DO NOTHING;