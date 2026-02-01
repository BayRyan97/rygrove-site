import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  userId: string;
}

interface ResponseBody {
  tempPassword: string;
  message: string;
}

export const handler = async (req: Request): Promise<Response> => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { userId } = (await req.json()) as RequestBody;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400 });
    }

    // Create admin client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Generate a temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(-12)}!`;

    // Update user password
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: tempPassword
    });

    if (error) {
      console.error('Error updating password:', error);
      return new Response(
        JSON.stringify({ error: `Failed to reset password: ${error.message}` }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({
        tempPassword,
        message: 'Password reset successfully'
      } as ResponseBody),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500 }
    );
  }
};
