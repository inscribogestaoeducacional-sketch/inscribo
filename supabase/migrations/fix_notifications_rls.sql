-- Allow system_notifications with institution_id NULL (super admin notifications)
-- and ensure institution users can only see their own notifications.

DROP POLICY IF EXISTS "notifications_insert" ON system_notifications;
CREATE POLICY "notifications_insert" ON system_notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_select" ON system_notifications;
CREATE POLICY "notifications_select" ON system_notifications
  FOR SELECT USING (
    institution_id IS NULL
    OR institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "notifications_update" ON system_notifications;
CREATE POLICY "notifications_update" ON system_notifications
  FOR UPDATE USING (
    institution_id IS NULL
    OR institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );
