BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'system';

UPDATE users
SET locale = 'ko'
WHERE locale IS NULL
   OR lower(locale) NOT IN ('ko', 'en', 'ja');

UPDATE users
SET theme = 'system'
WHERE theme IS NULL
   OR lower(theme) NOT IN ('system', 'light', 'dark');

ALTER TABLE users
  ALTER COLUMN locale SET DEFAULT 'ko',
  ALTER COLUMN theme SET DEFAULT 'system';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_users_locale_supported'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_locale_supported
      CHECK (lower(locale) IN ('ko', 'en', 'ja'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_users_theme_supported'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_theme_supported
      CHECK (lower(theme) IN ('system', 'light', 'dark'));
  END IF;
END $$;

COMMENT ON COLUMN users.locale IS
  'UI locale preference. Supported values: ko, en, ja.';

COMMENT ON COLUMN users.theme IS
  'UI theme preference. Supported values: system, light, dark.';

COMMIT;
