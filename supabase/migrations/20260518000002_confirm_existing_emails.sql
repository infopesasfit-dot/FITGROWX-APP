-- Mark all existing users as email-confirmed so they are not locked out
-- when "Confirm email" is enabled in Supabase Auth settings.
-- Run this migration BEFORE toggling the setting in the Supabase dashboard.
UPDATE auth.users
SET    email_confirmed_at = now()
WHERE  email_confirmed_at IS NULL;
