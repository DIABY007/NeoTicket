-- Add SEO-friendly slug managed by organizers.
ALTER TABLE events
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill slug for existing events.
UPDATE events
SET slug = trim(both '-' from regexp_replace(
  lower(
    coalesce(title, 'evenement') || '-' ||
    coalesce(city, 'burkina-faso') || '-' ||
    to_char(date, 'YYYY') || '-' ||
    left(replace(id::text, '-', ''), 6)
  ),
  '[^a-z0-9]+',
  '-',
  'g'
))
WHERE slug IS NULL OR slug = '';

ALTER TABLE events
ALTER COLUMN slug SET NOT NULL;

ALTER TABLE events
ADD CONSTRAINT events_slug_format_chk
CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_unique_idx
ON events (slug);
