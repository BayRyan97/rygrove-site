-- Create AI chat sessions and messages for Ask AI page

CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_updated
  ON public.ai_chat_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_created
  ON public.ai_chat_messages (session_id, created_at ASC);

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own AI chat sessions" ON public.ai_chat_sessions;
CREATE POLICY "Users can view own AI chat sessions"
  ON public.ai_chat_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own AI chat sessions" ON public.ai_chat_sessions;
CREATE POLICY "Users can insert own AI chat sessions"
  ON public.ai_chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own AI chat sessions" ON public.ai_chat_sessions;
CREATE POLICY "Users can update own AI chat sessions"
  ON public.ai_chat_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own AI chat messages" ON public.ai_chat_messages;
CREATE POLICY "Users can view own AI chat messages"
  ON public.ai_chat_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own AI chat messages" ON public.ai_chat_messages;
CREATE POLICY "Users can insert own AI chat messages"
  ON public.ai_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
