@@ .. @@
 ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
 
-CREATE POLICY "Users can access their institution data"
+CREATE POLICY "Authenticated users can manage institutions"
   ON institutions
   FOR ALL
   TO authenticated
-  USING (id IN (
-    SELECT institution_id FROM users WHERE id = auth.uid()
-  ));
+  USING (true)
+  WITH CHECK (true);