CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  instance_name TEXT,
  remote_jid TEXT NOT NULL,
  message_id TEXT UNIQUE,
  from_me BOOLEAN DEFAULT false,
  message_type TEXT DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  status TEXT DEFAULT 'received',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_institution ON public.whatsapp_messages(institution_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_jid ON public.whatsapp_messages(institution_id, remote_jid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON public.whatsapp_messages(timestamp DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Institution can manage own messages" ON public.whatsapp_messages;
CREATE POLICY "Institution can manage own messages" ON public.whatsapp_messages
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM public.users WHERE id = auth.uid()
    )
  );
