/*
  # Add support for different metric types
  
  1. Changes
    - Metrics in contests can now be of type 'boolean' (yes/no) or 'number' (measurable)
    - Boolean metrics will be tracked as 1 (yes/done) or 0 (no/not done)
    - Number metrics will store the actual value
    
  2. Notes
    - No schema changes needed - metrics are already stored as JSONB
    - This migration documents the supported structure:
      {
        "id": "unique-id",
        "name": "metric_name",
        "label": "Display Label",
        "type": "boolean" | "number",
        "unit": "unit of measurement" (for number type)
      }
    - Metric values in submissions will store the appropriate type
*/

-- No actual schema changes needed, just documenting the structure
-- This ensures the migration history tracks this important change

COMMENT ON COLUMN contests.metrics IS 'Array of metric definitions. Each metric has: id, name, label, type (boolean|number), unit';
COMMENT ON COLUMN submissions.metric_values IS 'JSONB object mapping metric names to their values (boolean: true/false, number: numeric value)';
