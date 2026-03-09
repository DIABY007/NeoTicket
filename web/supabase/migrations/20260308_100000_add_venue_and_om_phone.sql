-- NeoTicket - Add venue + organizer Orange Money phone to events

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS om_receiver_phone TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_venue_len_chk'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_venue_len_chk
      CHECK (venue IS NULL OR char_length(btrim(venue)) BETWEEN 1 AND 200);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_om_receiver_phone_e164_chk'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_om_receiver_phone_e164_chk
      CHECK (om_receiver_phone IS NULL OR om_receiver_phone ~ '^\+[1-9][0-9]{6,14}$');
  END IF;
END $$;
