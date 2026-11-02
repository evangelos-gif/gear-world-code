-- Gear World Hub D1 (gear-world-registry): email sign-ups to MailerLite (Gear World email, step 5), November 2026.
-- Additive: four new columns in hub_subscribers, one index and one new table. Nothing is deleted.
-- Run once by tools/gwh-mailerlite.ps1 -Step live, only after the approval phrase and a Time Travel restore point
-- (the tool runs it only when the column ml_status is not there yet: ALTER TABLE cannot run twice).
--
-- ml_status: 'pending' = still to be sent to MailerLite (new sign-ups start here), 'synced' = in MailerLite,
--            'failed' = MailerLite refused it or did not answer for two days, 'hold' = signed up BEFORE this change:
--            these go to MailerLite only with email step 6 (count shown first, owner's approval).
-- subscribe_usage: fair-use count of sign-up attempts, one row per visitor and hour. "visitor" is a one-way code
--            that changes every day (SHA-256 of a secret, the day and the IP address); the IP is never stored.
--            Rows older than 48 hours are deleted by the Worker.

ALTER TABLE hub_subscribers ADD COLUMN ml_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE hub_subscribers ADD COLUMN ml_synced_at TEXT;
ALTER TABLE hub_subscribers ADD COLUMN ml_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hub_subscribers ADD COLUMN ml_error TEXT;
UPDATE hub_subscribers SET ml_status = 'hold';
CREATE INDEX IF NOT EXISTS idx_hub_subscribers_ml_status ON hub_subscribers(ml_status);

CREATE TABLE IF NOT EXISTS subscribe_usage (
  visitor TEXT NOT NULL,
  hour TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (visitor, hour)
);
