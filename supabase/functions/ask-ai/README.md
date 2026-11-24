# Ask AI

The Ask AI page posts questions to this edge function. It has two engines:

- **Keyword engine** (default, `index.ts`): matches words in the question to a fixed set of question types. This is what runs today.
- **Claude engine** (`claude.ts`): Claude reads the question and answers it by calling a few read-only lookups (people, jobs, time entries, expenses, invoices). It understands names, jobs, single days and follow-up questions.

## Turning on the Claude engine

The Claude engine stays off until an Anthropic API key is set, so deploying this code changes nothing on its own.

1. Create an API key at console.anthropic.com.
2. Add it as a secret on the Supabase project: `supabase secrets set ANTHROPIC_API_KEY=...` (or Dashboard > Edge Functions > Secrets).
3. Deploy the function: `supabase functions deploy ask-ai`.

Optional settings:

- `ASK_AI_MODEL`: which Claude model to use. Defaults to `claude-opus-5-5`.
- `ASK_AI_ENGINE=keyword`: switch back to the keyword engine without removing the key.

If a Claude request fails for any reason, the function logs the error and answers with the keyword engine instead.

## Who sees what

Claude's lookups run with the signed-in person's own token, so the database's row level security decides what they can see. Admins see everyone's data; other roles see only what their policies allow. The lookups only read data; nothing in the Claude engine can change it.
