@@ .. @@
 -- Institutions table
 CREATE TABLE IF NOT EXISTS institutions (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   name text NOT NULL,
   logo_url text,
   primary_color text DEFAULT '#3B82F6',
   secondary_color text DEFAULT '#10B981',
+  phone text,
+  email text,
+  address text,
+  website text,
+  active boolean DEFAULT true,
   created_at timestamptz DEFAULT now(),
   updated_at timestamptz DEFAULT now()
 );