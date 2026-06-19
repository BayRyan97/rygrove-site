-- Allow authenticated users to delete their own AI chat history

DROP POLICY IF EXISTS "Users can delete own AI chat sessions" ON public.ai_chat_sessions;
CREATE POLICY "Users can delete own AI chat sessions"
  ON public.ai_chat_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own AI chat messages" ON public.ai_chat_messages;
CREATE POLICY "Users can delete own AI chat messages"
  ON public.ai_chat_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
