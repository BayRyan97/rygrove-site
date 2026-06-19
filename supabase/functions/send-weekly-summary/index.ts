import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  role: string | null;
  email: string | null;
  rate: number | null;
}

interface TimeEntryRow {
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  lunch_break: string | null;
  location: string | null;
}

interface ExpenseRow {
  user_id: string;
  amount: number | null;
  date: string | null;
  location: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('Authorization') ?? '';

    // Accept either the CRON_SECRET (pg_cron scheduler) or a valid admin JWT (dashboard button)
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;
    if (!isCronCall) {
      // Validate as an authenticated admin user
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await userClient.auth.getUser();
      if (userErr || !user) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      const { data: profile } = await userClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role !== 'admin') {
        return jsonResponse({ error: 'Forbidden: admin only' }, 403);
      }
    }
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Rygrove <reports@yourdomain.com>';

    const db = createClient(supabaseUrl, serviceRoleKey);

    // Date range: last 7 full days ending yesterday (Mon–Sat when run on Sunday)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(now.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch data in parallel
    const [profilesRes, entriesRes, expensesRes] = await Promise.all([
      db.from('profiles').select('id, full_name, role, email, rate'),
      db.from('time_entries').select('user_id, date, start_time, end_time, lunch_break, location').gte('date', startStr).lte('date', endStr),
      db.from('expenses').select('user_id, amount, date, location').gte('date', startStr).lte('date', endStr),
    ]);

    const profiles: ProfileRow[] = profilesRes.data ?? [];
    const timeEntries: TimeEntryRow[] = entriesRes.data ?? [];
    const expenses: ExpenseRow[] = expensesRes.data ?? [];

    const adminProfiles = profiles.filter(p => p.role === 'admin');
    const employeeProfiles = profiles.filter(p => p.role !== 'admin');

    // Aggregate hours & locations per user
    const hoursByUser: Record<string, number> = {};
    const locationsByUser: Record<string, Set<string>> = {};
    const locationTotals: Record<string, number> = {};

    for (const e of timeEntries) {
      const h = calcHours(e.start_time, e.end_time, e.lunch_break);
      hoursByUser[e.user_id] = (hoursByUser[e.user_id] ?? 0) + h;
      if (e.location) {
        if (!locationsByUser[e.user_id]) locationsByUser[e.user_id] = new Set();
        locationsByUser[e.user_id].add(e.location);
        locationTotals[e.location] = (locationTotals[e.location] ?? 0) + h;
      }
    }

    const totalHours = Object.values(hoursByUser).reduce((a, b) => a + b, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);

    const employeeRows = employeeProfiles
      .filter(p => hoursByUser[p.id])
      .sort((a, b) => (hoursByUser[b.id] ?? 0) - (hoursByUser[a.id] ?? 0))
      .map(p => ({
        name: p.full_name ?? '—',
        hours: (hoursByUser[p.id] ?? 0).toFixed(2),
        locations: Array.from(locationsByUser[p.id] ?? []).join(', ') || '—',
      }));

    const noHoursNames = employeeProfiles
      .filter(p => !hoursByUser[p.id])
      .map(p => p.full_name ?? 'Unknown');

    const topLocations = Object.entries(locationTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);

    const weekLabel = `${fmtDate(startDate)} – ${fmtDate(endDate)}`;
    const html = buildHtml({ weekLabel, totalHours: totalHours.toFixed(1), totalExpenses: totalExpenses.toFixed(2), employeeRows, topLocations, noHoursNames });

    // Send to every admin with an email
    const adminEmails = adminProfiles.map(p => p.email).filter((e): e is string => !!e);
    if (adminEmails.length === 0) {
      return jsonResponse({ error: 'No admin emails found in profiles' }, 400);
    }

    for (const to of adminEmails) {
      await sendViaResend(resendApiKey, fromEmail, to, `Rygrove Weekly Summary – ${weekLabel}`, html);
    }

    return jsonResponse({ success: true, sent: adminEmails.length, weekLabel });
  } catch (err) {
    console.error('[send-weekly-summary]', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcHours(start: string, end: string, lunch: string | null): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const total = (eh * 60 + em - (sh * 60 + sm)) / 60;
  const lunchH = lunch ? parseFloat(lunch) : 0;
  return Math.max(0, total - lunchH);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Email template ──────────────────────────────────────────────────────────

function buildHtml({
  weekLabel,
  totalHours,
  totalExpenses,
  employeeRows,
  topLocations,
  noHoursNames,
}: {
  weekLabel: string;
  totalHours: string;
  totalExpenses: string;
  employeeRows: { name: string; hours: string; locations: string }[];
  topLocations: [string, number][];
  noHoursNames: string[];
}): string {
  const tdStyle = 'padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;';
  const thStyle = 'padding:8px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e5e7eb;background:#f9fafb;';

  const employeeTableRows = employeeRows.length
    ? employeeRows.map(r =>
        `<tr>
          <td style="${tdStyle}">${r.name}</td>
          <td style="${tdStyle}text-align:right;font-weight:600;">${r.hours}</td>
          <td style="${tdStyle}color:#6b7280;">${r.locations}</td>
        </tr>`
      ).join('')
    : `<tr><td colspan="3" style="padding:14px;color:#9ca3af;text-align:center;font-size:14px;">No hours logged this week</td></tr>`;

  const locationRows = topLocations
    .map(([loc, h]) =>
      `<tr>
        <td style="${tdStyle}">${loc}</td>
        <td style="${tdStyle}text-align:right;font-weight:600;">${h.toFixed(1)} hrs</td>
      </tr>`
    ).join('');

  const alertBox = noHoursNames.length
    ? `<div style="margin:0 0 24px;padding:12px 16px;background:#fef9c3;border-left:4px solid #eab308;border-radius:6px;font-size:13px;">
        <strong style="color:#78350f;">No hours logged:</strong>
        <span style="color:#92400e;margin-left:6px;">${noHoursNames.join(', ')}</span>
      </div>`
    : '';

  const locSection = topLocations.length
    ? `<h2 style="color:#111827;font-size:15px;font-weight:700;margin:28px 0 12px;">Top Locations</h2>
       <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
         <thead><tr>
           <th style="${thStyle}">Location</th>
           <th style="${thStyle}text-align:right;">Hours</th>
         </tr></thead>
         <tbody>${locationRows}</tbody>
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;margin:0;padding:32px 16px;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 100%);padding:36px 32px 28px;">
      <p style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px;">Weekly Summary</p>
      <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0 0 6px;">Rygrove</h1>
      <p style="color:#93c5fd;font-size:14px;margin:0;">${weekLabel}</p>
    </div>

    <!-- Stats -->
    <div style="padding:28px 32px 0;display:flex;gap:16px;">
      <div style="flex:1;background:#eff6ff;border-radius:10px;padding:18px 20px;">
        <p style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;">Total Hours</p>
        <p style="color:#1e40af;font-size:32px;font-weight:800;margin:0;">${totalHours}</p>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:10px;padding:18px 20px;">
        <p style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;">Total Expenses</p>
        <p style="color:#166534;font-size:32px;font-weight:800;margin:0;">$${totalExpenses}</p>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:24px 32px 32px;">
      ${alertBox}

      <h2 style="color:#111827;font-size:15px;font-weight:700;margin:4px 0 12px;">Hours by Employee</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <thead>
          <tr>
            <th style="${thStyle}">Employee</th>
            <th style="${thStyle}text-align:right;">Hours</th>
            <th style="${thStyle}">Locations</th>
          </tr>
        </thead>
        <tbody>${employeeTableRows}</tbody>
      </table>

      ${locSection}

      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f3f4f6;text-align:center;">
        <p style="color:#d1d5db;font-size:12px;margin:0;">Rygrove &middot; Automated weekly report &middot; Every Sunday morning</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
