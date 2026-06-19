import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AskAiRequestBody {
  question: string;
  sessionId?: string;
}

interface TimeEntryRow {
  date: string;
  start_time: string;
  end_time: string;
  lunch_break: string | null;
  location: string | null;
  full_name: string;
  user_id: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  role: string | null;
}

interface NameResolution {
  match: ProfileRow | null;
  needsClarification: boolean;
  clarificationOptions: string[];
}

interface PriorConversationContext {
  intent?: AskIntent;
  subject?: string;
  targetUserId?: string | null;
  startDate?: string;
  endDate?: string;
  rangeLabel?: string;
}

interface LocationHours {
  location: string;
  hours: number;
}

interface ExpenseRow {
  id: string;
  amount: number;
  user_id: string;
  date: string | null;
  location: string | null;
  time_entry_id: string | null;
  time_entries?: {
    location?: string | null;
    date?: string | null;
  } | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  created_by: string;
  location: string | null;
  grand_total: number;
  amount_paid: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  status: 'draft' | 'finalized' | 'void';
  created_at: string;
}

type AskIntent =
  | 'hours_summary'
  | 'locations_summary'
  | 'locations_chart'
  | 'expenses_count'
  | 'expenses_total'
  | 'expenses_by_job'
  | 'invoices_count'
  | 'invoices_total'
  | 'invoices_outstanding';
type AskToolName =
  | 'fetch_time_entries'
  | 'compute_hours_summary'
  | 'compute_locations_summary'
  | 'compute_locations_chart'
  | 'fetch_expenses'
  | 'compute_expenses_count'
  | 'compute_expenses_total'
  | 'compute_expenses_by_job'
  | 'fetch_invoices'
  | 'compute_invoices_count'
  | 'compute_invoices_total'
  | 'compute_invoices_outstanding'
  | 'compose_concise_summary';

interface AskToolCallRecord {
  tool: AskToolName;
  args: Record<string, unknown>;
}

interface AskToolContext {
  serviceClient: ReturnType<typeof createClient>;
  startDate: string;
  endDate: string;
  targetUserId: string | null;
  isPrivileged: boolean;
  fallbackUserId: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function toDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRangeFromQuestion(question: string): { startDate: string; endDate: string; label: string } {
  const q = question.toLowerCase();
  const now = new Date();

  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let startDate = new Date(endDate);
  let label = 'last 7 days';

  if (q.includes('this month')) {
    startDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
    label = 'this month';
  } else if (q.includes('this year')) {
    startDate = new Date(Date.UTC(endDate.getUTCFullYear(), 0, 1));
    label = 'this year';
  } else if (q.includes('this quarter')) {
    const quarterStartMonth = Math.floor(endDate.getUTCMonth() / 3) * 3;
    startDate = new Date(Date.UTC(endDate.getUTCFullYear(), quarterStartMonth, 1));
    label = 'this quarter';
  } else if (q.includes('last 30 days')) {
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 30);
    label = 'last 30 days';
  } else if (/last\s+3\s+month(s)?/.test(q)) {
    startDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - 2, 1));
    label = 'last 3 months';
  } else if (q.includes('this week') || q.includes('week')) {
    const day = endDate.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - diffToMonday);
    label = 'this week';
  } else {
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 7);
  }

  return {
    startDate: toDateString(startDate),
    endDate: toDateString(endDate),
    label,
  };
}

function parseHoursFromEntry(entry: TimeEntryRow): number {
  if (!entry.start_time || !entry.end_time) {
    return 0;
  }

  const [startHour, startMinute] = entry.start_time.split(':').map(Number);
  const [endHour, endMinute] = entry.end_time.split(':').map(Number);

  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes < 0) {
    // Handle entries that cross midnight, though uncommon for this app.
    minutes += 24 * 60;
  }

  if (entry.lunch_break) {
    const lunchParts = entry.lunch_break.split(':').map(Number);
    if (lunchParts.length >= 2) {
      minutes -= lunchParts[0] * 60 + lunchParts[1];
    }
  }

  if (minutes < 0) {
    return 0;
  }

  return minutes / 60;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getFirstName(fullName: string | null): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0]?.toLowerCase() || '';
}

function resolvePersonFromQuestion(question: string, profiles: ProfileRow[]): NameResolution {
  const q = question.toLowerCase();

  const fullNameMatches = profiles
    .filter((p) => p.full_name)
    .filter((p) => q.includes((p.full_name || '').toLowerCase()));

  if (fullNameMatches.length === 1) {
    return { match: fullNameMatches[0], needsClarification: false, clarificationOptions: [] };
  }

  if (fullNameMatches.length > 1) {
    const options = fullNameMatches
      .map((p) => p.full_name || '')
      .filter(Boolean)
      .sort();

    return {
      match: null,
      needsClarification: true,
      clarificationOptions: options,
    };
  }

  const firstNameMatches = profiles.filter((p) => {
    const firstName = getFirstName(p.full_name);
    if (!firstName) return false;
    const pattern = new RegExp(`\\b${escapeRegex(firstName)}\\b`, 'i');
    return pattern.test(question);
  });

  if (firstNameMatches.length === 1) {
    return { match: firstNameMatches[0], needsClarification: false, clarificationOptions: [] };
  }

  if (firstNameMatches.length > 1) {
    const options = firstNameMatches
      .map((p) => p.full_name || '')
      .filter(Boolean)
      .sort();

    return {
      match: null,
      needsClarification: true,
      clarificationOptions: options,
    };
  }

  return { match: null, needsClarification: false, clarificationOptions: [] };
}

function detectIntent(question: string): AskIntent {
  const q = question.toLowerCase();
  const asksInvoice =
    q.includes('invoice') ||
    q.includes('invoices') ||
    q.includes('billed') ||
    q.includes('billing');
  const asksExpense = q.includes('expense') || q.includes('expenses');
  const asksCount = q.includes('how many') || q.includes('count') || q.includes('number of');
  const asksAmount = q.includes('how much') || q.includes('total') || q.includes('sum');
  const asksJobOrLocation = q.includes('job') || q.includes('location') || q.includes('site') || q.includes('for a job') || q.includes('for job');

  if (asksInvoice) {
    const asksOutstanding =
      q.includes('outstanding') ||
      q.includes('unpaid') ||
      q.includes('open') ||
      q.includes('remaining') ||
      q.includes('balance due') ||
      q.includes('still owed');

    if (asksOutstanding) {
      return 'invoices_outstanding';
    }

    if (asksCount) {
      return 'invoices_count';
    }

    return 'invoices_total';
  }

  if (asksExpense && asksAmount && asksJobOrLocation) {
    return 'expenses_by_job';
  }

  if (asksExpense && asksCount) {
    return 'expenses_count';
  }

  if (asksExpense && asksAmount) {
    return 'expenses_total';
  }

  const asksWhereWorked = /\bwhere\b.*\bwork(ed)?\b/i.test(question) || q.includes('where did') || q.includes('where was');
  const asksLocation =
    q.includes('location') ||
    q.includes('locations') ||
    q.includes('job') ||
    q.includes('jobs') ||
    q.includes('job site') ||
    q.includes('jobsite') ||
    asksWhereWorked;
  const asksChart = q.includes('chart') || q.includes('graph') || q.includes('visual');

  if (asksLocation && asksChart) {
    return 'locations_chart';
  }

  if (asksLocation) {
    return 'locations_summary';
  }

  return 'hours_summary';
}

function hasExplicitDateRange(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.includes('today') ||
    q.includes('yesterday') ||
    q.includes('this week') ||
    q.includes('last week') ||
    q.includes('this month') ||
    q.includes('last month') ||
    q.includes('this quarter') ||
    q.includes('this year') ||
    q.includes('last 7 days') ||
    q.includes('last 30 days') ||
    /last\s+3\s+month(s)?/.test(q)
  );
}

function hasIntentSignals(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.includes('hour') ||
    q.includes('time') ||
    q.includes('invoice') ||
    q.includes('invoices') ||
    q.includes('billing') ||
    q.includes('billed') ||
    q.includes('expense') ||
    q.includes('cost') ||
    q.includes('location') ||
    q.includes('job') ||
    q.includes('site') ||
    q.includes('chart') ||
    q.includes('graph')
  );
}

function isFollowUpQuestion(question: string): boolean {
  const q = question.toLowerCase();

  const directFollowUpPhrases = [
    'now show',
    'show that',
    'break that down',
    'what about',
    'same for',
    'same period',
    'same range',
    'that by',
    'those by',
    'and by',
  ];

  if (directFollowUpPhrases.some((phrase) => q.includes(phrase))) {
    return true;
  }

  return /\b(that|those|it|them|their|same|now)\b/i.test(question);
}

function extractPriorConversationContext(recentAssistantMessages: Array<{ metadata?: Record<string, unknown> }>): PriorConversationContext {
  for (const message of recentAssistantMessages) {
    const metadata = message.metadata || {};
    const intent = String(metadata.intent || '');

    if (intent === 'clarification_needed') {
      continue;
    }

    const parsedIntent = (
      intent === 'hours_summary' ||
      intent === 'locations_summary' ||
      intent === 'locations_chart' ||
      intent === 'expenses_count' ||
      intent === 'expenses_total' ||
      intent === 'expenses_by_job' ||
      intent === 'invoices_count' ||
      intent === 'invoices_total' ||
      intent === 'invoices_outstanding'
    )
      ? (intent as AskIntent)
      : undefined;

    return {
      intent: parsedIntent,
      subject: typeof metadata.subject === 'string' ? metadata.subject : undefined,
      targetUserId: typeof metadata.targetUserId === 'string' ? metadata.targetUserId : null,
      startDate: typeof metadata.startDate === 'string' ? metadata.startDate : undefined,
      endDate: typeof metadata.endDate === 'string' ? metadata.endDate : undefined,
      rangeLabel: typeof metadata.rangeLabel === 'string' ? metadata.rangeLabel : undefined,
    };
  }

  return {};
}

function aggregateHoursByLocation(entries: TimeEntryRow[]): LocationHours[] {
  const map = new Map<string, number>();

  for (const entry of entries) {
    const location = entry.location || 'Unknown';
    const current = map.get(location) || 0;
    map.set(location, current + parseHoursFromEntry(entry));
  }

  return Array.from(map.entries())
    .map(([location, hours]) => ({ location, hours: Number(hours.toFixed(2)) }))
    .sort((a, b) => b.hours - a.hours);
}

function parseReferenceToPreviousPerson(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.includes('that person') ||
    q.includes('that employee') ||
    /\b(that|them|their)\b/i.test(question)
  );
}

function asksForAllPeople(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes('everyone') || q.includes('all') || q.includes('people') || q.includes('employees') || q.includes('team');
}

function aggregateLocationsByPerson(entries: TimeEntryRow[]): Array<{ person: string; locations: string[]; totalHours: number }> {
  const personMap = new Map<string, { locations: Set<string>; hours: number }>();

  for (const entry of entries) {
    const person = entry.full_name || 'Unknown';
    const existing = personMap.get(person) || { locations: new Set<string>(), hours: 0 };
    existing.locations.add(entry.location || 'Unknown');
    existing.hours += parseHoursFromEntry(entry);
    personMap.set(person, existing);
  }

  return Array.from(personMap.entries())
    .map(([person, value]) => ({
      person,
      locations: Array.from(value.locations).sort(),
      totalHours: Number(value.hours.toFixed(2)),
    }))
    .sort((a, b) => a.person.localeCompare(b.person));
}

function getEffectiveExpenseLocation(expense: ExpenseRow): string {
  return expense.location || expense.time_entries?.location || 'Unknown';
}

function findLocationInQuestion(question: string, locations: string[]): string | null {
  const q = question.toLowerCase();
  const matches = locations
    .filter((location) => location && q.includes(location.toLowerCase()))
    .sort((a, b) => b.length - a.length);

  return matches[0] || null;
}

function buildToolRegistry() {
  const tools: Record<AskToolName, (args: Record<string, unknown>, ctx: AskToolContext) => Promise<Record<string, unknown>>> = {
    fetch_time_entries: async (_args, ctx) => {
      let query = ctx.serviceClient
        .from('time_entries')
        .select('date, start_time, end_time, lunch_break, full_name, user_id, location')
        .gte('date', ctx.startDate)
        .lte('date', ctx.endDate);

      if (ctx.targetUserId) {
        query = query.eq('user_id', ctx.targetUserId);
      } else if (!ctx.isPrivileged) {
        query = query.eq('user_id', ctx.fallbackUserId);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error('Failed to query time entries');
      }

      return { entries: (data || []) as TimeEntryRow[] };
    },
    compute_hours_summary: async (args) => {
      const entries = (args.entries || []) as TimeEntryRow[];
      const subjectLabel = String(args.subjectLabel || 'you');
      const rangeLabel = String(args.rangeLabel || 'selected range');
      const startDate = String(args.startDate || '');
      const endDate = String(args.endDate || '');

      const totalHours = entries.reduce((sum, entry) => sum + parseHoursFromEntry(entry), 0);
      const roundedHours = Number(totalHours.toFixed(2));

      const answer = `Total hours for ${subjectLabel} in ${rangeLabel} (${startDate} to ${endDate}): ${roundedHours} hours across ${entries.length} entries.`;
      return {
        answer,
        totalHours: roundedHours,
        entryCount: entries.length,
      };
    },
    compute_locations_summary: async (args) => {
      const entries = (args.entries || []) as TimeEntryRow[];
      const subjectLabel = String(args.subjectLabel || 'you');
      const rangeLabel = String(args.rangeLabel || 'selected range');
      const startDate = String(args.startDate || '');
      const endDate = String(args.endDate || '');

      const locationHours = aggregateHoursByLocation(entries);
      const totalHours = Number(entries.reduce((sum, entry) => sum + parseHoursFromEntry(entry), 0).toFixed(2));

      const allPeople = Boolean(args.allPeople);
      const byPerson = aggregateLocationsByPerson(entries);

      let answer = locationHours.length > 0
        ? `${subjectLabel} worked at ${locationHours.length} location(s) in ${rangeLabel} (${startDate} to ${endDate}). Locations: ${locationHours.map((item) => `${item.location} (${item.hours}h)`).join(', ')}.`
        : `No locations found for ${subjectLabel} in ${rangeLabel} (${startDate} to ${endDate}).`;

      if (allPeople) {
        answer = byPerson.length > 0
          ? `Found ${byPerson.length} employees with logged jobs/locations this period.`
          : `No jobs/locations found for employees in ${rangeLabel} (${startDate} to ${endDate}).`;
      }

      return {
        answer,
        totalHours,
        locationCount: locationHours.length,
        locations: locationHours,
        byPerson,
      };
    },
    compute_locations_chart: async (args) => {
      const entries = (args.entries || []) as TimeEntryRow[];
      const subjectLabel = String(args.subjectLabel || 'you');
      const rangeLabel = String(args.rangeLabel || 'selected range');
      const startDate = String(args.startDate || '');
      const endDate = String(args.endDate || '');

      const locationHours = aggregateHoursByLocation(entries);
      const totalHours = Number(entries.reduce((sum, entry) => sum + parseHoursFromEntry(entry), 0).toFixed(2));

      const answer = locationHours.length > 0
        ? `Here is the location breakdown for ${subjectLabel} in ${rangeLabel} (${startDate} to ${endDate}).`
        : `No locations found for ${subjectLabel} in ${rangeLabel} (${startDate} to ${endDate}), so I cannot generate a chart yet.`;

      return {
        answer,
        totalHours,
        locationCount: locationHours.length,
        locations: locationHours,
        chart: {
          type: 'bar',
          title: `${subjectLabel} hours by location`,
          labels: locationHours.map((item) => item.location),
          values: locationHours.map((item) => item.hours),
        },
      };
    },
    fetch_expenses: async (_args, ctx) => {
      let query = ctx.serviceClient
        .from('expenses')
        .select('id, amount, user_id, date, location, time_entry_id, time_entries(location, date)')
        .gte('date', ctx.startDate)
        .lte('date', ctx.endDate);

      if (ctx.targetUserId) {
        query = query.eq('user_id', ctx.targetUserId);
      } else if (!ctx.isPrivileged) {
        query = query.eq('user_id', ctx.fallbackUserId);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error('Failed to query expenses');
      }

      return { expenses: (data || []) as ExpenseRow[] };
    },
    compute_expenses_count: async (args) => {
      const expenses = (args.expenses || []) as ExpenseRow[];
      const subjectLabel = String(args.subjectLabel || 'you');
      const rangeLabel = String(args.rangeLabel || 'selected range');
      const startDate = String(args.startDate || '');
      const endDate = String(args.endDate || '');

      const count = expenses.length;
      const totalAmount = Number(expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2));
      const answer = `${subjectLabel} submitted ${count} expense${count === 1 ? '' : 's'} in ${rangeLabel} (${startDate} to ${endDate}), totaling $${totalAmount.toFixed(2)}.`;

      return { answer, count, totalAmount };
    },
    compute_expenses_total: async (args) => {
      const expenses = (args.expenses || []) as ExpenseRow[];
      const subjectLabel = String(args.subjectLabel || 'you');
      const rangeLabel = String(args.rangeLabel || 'selected range');
      const startDate = String(args.startDate || '');
      const endDate = String(args.endDate || '');

      const totalAmount = Number(expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2));
      const answer = `Total expenses for ${subjectLabel} in ${rangeLabel} (${startDate} to ${endDate}) are $${totalAmount.toFixed(2)} across ${expenses.length} expense${expenses.length === 1 ? '' : 's'}.`;

      return { answer, totalAmount, count: expenses.length };
    },
    compute_expenses_by_job: async (args) => {
      const expenses = (args.expenses || []) as ExpenseRow[];
      const question = String(args.question || '');
      const subjectLabel = String(args.subjectLabel || 'you');
      const rangeLabel = String(args.rangeLabel || 'selected range');
      const startDate = String(args.startDate || '');
      const endDate = String(args.endDate || '');

      const knownLocations = Array.from(new Set(expenses.map((e) => getEffectiveExpenseLocation(e)).filter(Boolean))).sort();
      const matchedLocation = findLocationInQuestion(question, knownLocations);

      if (!matchedLocation) {
        const answer = knownLocations.length > 0
          ? `I can calculate job/location expense totals, but I need the location name. I found these locations in ${rangeLabel}: ${knownLocations.join(', ')}.`
          : `I could not find any expense locations for ${subjectLabel} in ${rangeLabel} (${startDate} to ${endDate}).`;

        return {
          answer,
          needsClarification: knownLocations.length > 0,
          options: knownLocations,
          location: null,
          totalAmount: 0,
          count: 0,
        };
      }

      const matchedExpenses = expenses.filter((expense) => getEffectiveExpenseLocation(expense).toLowerCase() === matchedLocation.toLowerCase());
      const totalAmount = Number(matchedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2));
      const count = matchedExpenses.length;
      const answer = `For ${subjectLabel}, expenses at ${matchedLocation} in ${rangeLabel} (${startDate} to ${endDate}) total $${totalAmount.toFixed(2)} across ${count} expense${count === 1 ? '' : 's'}.`;

      return {
        answer,
        needsClarification: false,
        options: [],
        location: matchedLocation,
        totalAmount,
        count,
      };
    },
    fetch_invoices: async (_args, ctx) => {
      let query = ctx.serviceClient
        .from('invoices')
        .select('id, invoice_number, created_by, location, grand_total, amount_paid, payment_status, status, created_at')
        .eq('status', 'finalized')
        .gte('created_at', `${ctx.startDate}T00:00:00.000Z`)
        .lte('created_at', `${ctx.endDate}T23:59:59.999Z`);

      if (ctx.targetUserId) {
        query = query.eq('created_by', ctx.targetUserId);
      } else if (!ctx.isPrivileged) {
        query = query.eq('created_by', ctx.fallbackUserId);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error('Failed to query invoices');
      }

      return { invoices: (data || []) as InvoiceRow[] };
    },
    compute_invoices_count: async (args) => {
      const invoices = (args.invoices || []) as InvoiceRow[];
      const subjectLabel = String(args.subjectLabel || 'you');
      const rangeLabel = String(args.rangeLabel || 'selected range');
      const startDate = String(args.startDate || '');
      const endDate = String(args.endDate || '');

      const paidCount = invoices.filter((invoice) => invoice.payment_status === 'paid').length;
      const partialCount = invoices.filter((invoice) => invoice.payment_status === 'partial').length;
      const unpaidCount = invoices.filter((invoice) => invoice.payment_status === 'unpaid').length;
      const answer = `${subjectLabel} has ${invoices.length} finalized invoice${invoices.length === 1 ? '' : 's'} in ${rangeLabel} (${startDate} to ${endDate}). Paid: ${paidCount}, Partial: ${partialCount}, Unpaid: ${unpaidCount}.`;

      return {
        answer,
        invoiceCount: invoices.length,
        paidCount,
        partialCount,
        unpaidCount,
      };
    },
    compute_invoices_total: async (args) => {
      const invoices = (args.invoices || []) as InvoiceRow[];
      const subjectLabel = String(args.subjectLabel || 'you');
      const rangeLabel = String(args.rangeLabel || 'selected range');
      const startDate = String(args.startDate || '');
      const endDate = String(args.endDate || '');

      const totalInvoiced = Number(invoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0).toFixed(2));
      const totalPaid = Number(invoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0).toFixed(2));
      const outstandingTotal = Number(Math.max(0, totalInvoiced - totalPaid).toFixed(2));

      const answer = `Total finalized invoicing for ${subjectLabel} in ${rangeLabel} (${startDate} to ${endDate}) is $${totalInvoiced.toFixed(2)} across ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}. Paid: $${totalPaid.toFixed(2)}. Outstanding: $${outstandingTotal.toFixed(2)}.`;

      return {
        answer,
        invoiceCount: invoices.length,
        totalInvoiced,
        totalPaid,
        outstandingTotal,
      };
    },
    compute_invoices_outstanding: async (args) => {
      const invoices = (args.invoices || []) as InvoiceRow[];
      const subjectLabel = String(args.subjectLabel || 'you');
      const rangeLabel = String(args.rangeLabel || 'selected range');
      const startDate = String(args.startDate || '');
      const endDate = String(args.endDate || '');

      const openInvoices = invoices.filter((invoice) => invoice.payment_status !== 'paid');
      const outstandingTotal = Number(
        openInvoices
          .reduce((sum, invoice) => sum + Math.max(0, Number(invoice.grand_total || 0) - Number(invoice.amount_paid || 0)), 0)
          .toFixed(2)
      );
      const paidCount = invoices.filter((invoice) => invoice.payment_status === 'paid').length;
      const partialCount = invoices.filter((invoice) => invoice.payment_status === 'partial').length;
      const unpaidCount = invoices.filter((invoice) => invoice.payment_status === 'unpaid').length;

      const answer = `${subjectLabel} has $${outstandingTotal.toFixed(2)} outstanding in ${openInvoices.length} open invoice${openInvoices.length === 1 ? '' : 's'} for ${rangeLabel} (${startDate} to ${endDate}). Paid: ${paidCount}, Partial: ${partialCount}, Unpaid: ${unpaidCount}.`;

      return {
        answer,
        invoiceCount: invoices.length,
        openInvoiceCount: openInvoices.length,
        totalInvoiced: Number(invoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0).toFixed(2)),
        totalPaid: Number(invoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0).toFixed(2)),
        outstandingTotal,
        paidCount,
        partialCount,
        unpaidCount,
      };
    },
    compose_concise_summary: async (args) => {
      const intent = String(args.intent || '');
      const subject = String(args.subject || 'you');
      const rangeLabel = String(args.rangeLabel || 'selected range');
      const startDate = String(args.startDate || '');
      const endDate = String(args.endDate || '');

      if (intent === 'locations_summary') {
        const byPerson = Array.isArray(args.byPerson)
          ? (args.byPerson as Array<unknown>)
          : [];
        const locationCount = Number(args.locationCount || 0);

        if (byPerson.length > 0) {
          return {
            summary: `${byPerson.length} employees found with jobs/locations for ${rangeLabel} (${startDate} to ${endDate}).`,
          };
        }

        return {
          summary: `${subject} has ${locationCount} location(s) in ${rangeLabel} (${startDate} to ${endDate}).`,
        };
      }

      if (intent === 'locations_chart') {
        const locationCount = Number(args.locationCount || 0);
        return {
          summary: `${locationCount} location(s) plotted for ${subject} in ${rangeLabel}.`,
        };
      }

      if (intent === 'expenses_count') {
        const expenseCount = Number(args.expenseCount || 0);
        return {
          summary: `${subject} submitted ${expenseCount} expense${expenseCount === 1 ? '' : 's'} in ${rangeLabel}.`,
        };
      }

      if (intent === 'expenses_total') {
        const amount = Number(args.totalExpenseAmount || 0).toFixed(2);
        return {
          summary: `${subject} has $${amount} in expenses for ${rangeLabel}.`,
        };
      }

      if (intent === 'expenses_by_job') {
        const location = args.location ? String(args.location) : 'the selected job';
        const amount = Number(args.totalExpenseAmount || 0).toFixed(2);
        return {
          summary: `${subject} has $${amount} in expenses for ${location} in ${rangeLabel}.`,
        };
      }

      if (intent === 'hours_summary') {
        const totalHours = Number(args.totalHours || 0);
        return {
          summary: `${subject} logged ${totalHours} hour${totalHours === 1 ? '' : 's'} in ${rangeLabel}.`,
        };
      }

      if (intent === 'invoices_count') {
        const invoiceCount = Number(args.invoiceCount || 0);
        return {
          summary: `${subject} has ${invoiceCount} finalized invoice${invoiceCount === 1 ? '' : 's'} in ${rangeLabel}.`,
        };
      }

      if (intent === 'invoices_total') {
        const totalInvoiced = Number(args.totalInvoiced || 0).toFixed(2);
        return {
          summary: `${subject} has $${totalInvoiced} in finalized invoices for ${rangeLabel}.`,
        };
      }

      if (intent === 'invoices_outstanding') {
        const outstandingTotal = Number(args.outstandingTotal || 0).toFixed(2);
        return {
          summary: `${subject} has $${outstandingTotal} outstanding in ${rangeLabel}.`,
        };
      }

      return {
        summary: `Summary ready for ${rangeLabel}.`,
      };
    },
  };

  return tools;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = parseBearerToken(req.headers.get('authorization'));
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = authData.user;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: currentProfile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .single();

    if (profileError || !currentProfile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as AskAiRequestBody;
    const question = body.question?.trim();
    if (!question) {
      return new Response(JSON.stringify({ error: 'question is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sessionId = body.sessionId;

    if (sessionId) {
      const { data: session, error: sessionError } = await serviceClient
        .from('ai_chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      const { data: createdSession, error: createSessionError } = await serviceClient
        .from('ai_chat_sessions')
        .insert({
          user_id: user.id,
          title: question.slice(0, 80),
        })
        .select('id')
        .single();

      if (createSessionError || !createdSession) {
        return new Response(JSON.stringify({ error: 'Failed to create session' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      sessionId = createdSession.id;
    }

    const userMessageInsert = await serviceClient.from('ai_chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'user',
      content: question,
    });

    if (userMessageInsert.error) {
      return new Response(JSON.stringify({ error: 'Failed to persist question' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const intentFromQuestion = detectIntent(question);
    const explicitDateRange = hasExplicitDateRange(question);
    const followUpQuestion = isFollowUpQuestion(question);

    const { data: recentAssistantMessages } = await serviceClient
      .from('ai_chat_messages')
      .select('metadata')
      .eq('session_id', sessionId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(10);

    const priorContext = extractPriorConversationContext((recentAssistantMessages || []) as Array<{ metadata?: Record<string, unknown> }>);

    const intent = (!hasIntentSignals(question) && followUpQuestion && priorContext.intent)
      ? priorContext.intent
      : intentFromQuestion;

    let { startDate, endDate, label } = getDateRangeFromQuestion(question);
    const hasPriorRange = Boolean(priorContext.startDate && priorContext.endDate);
    const canReusePriorRange = !explicitDateRange && followUpQuestion && hasPriorRange;

    if (canReusePriorRange) {
      startDate = String(priorContext.startDate);
      endDate = String(priorContext.endDate);
      label = priorContext.rangeLabel || 'previous range';
    }

    if (!explicitDateRange && !canReusePriorRange) {
      const clarificationMessage = 'Before I run that, do you mean this week or last 7 days?';

      const clarificationInsert = await serviceClient
        .from('ai_chat_messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'assistant',
          content: clarificationMessage,
          metadata: {
            intent: 'clarification_needed',
            reason: 'missing_date_range',
            options: ['this week', 'last 7 days'],
          },
        })
        .select('id, content, metadata')
        .single();

      if (clarificationInsert.error || !clarificationInsert.data) {
        return new Response(JSON.stringify({ error: 'Failed to persist clarification response' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await serviceClient
        .from('ai_chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({
          sessionId,
          answer: clarificationInsert.data.content,
          metadata: clarificationInsert.data.metadata,
          messageId: clarificationInsert.data.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const isPrivileged = currentProfile.role === 'admin' || currentProfile.role === 'supervisor';

    let targetProfile: ProfileRow | null = isPrivileged
      ? null
      : {
        id: currentProfile.id,
        full_name: currentProfile.full_name,
        role: currentProfile.role,
      };

    if (isPrivileged) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, full_name, role')
        .order('full_name');

      if (profiles && profiles.length > 0) {
        const nameResolution = resolvePersonFromQuestion(question, profiles as ProfileRow[]);

        if (nameResolution.needsClarification) {
          const clarificationMessage = `I found multiple employees with that name. Which one did you mean: ${nameResolution.clarificationOptions.join(', ')}?`;

          const clarificationInsert = await serviceClient
            .from('ai_chat_messages')
            .insert({
              session_id: sessionId,
              user_id: user.id,
              role: 'assistant',
              content: clarificationMessage,
              metadata: {
                intent: 'clarification_needed',
                reason: 'ambiguous_first_name',
                options: nameResolution.clarificationOptions,
              },
            })
            .select('id, content, metadata')
            .single();

          if (clarificationInsert.error || !clarificationInsert.data) {
            return new Response(JSON.stringify({ error: 'Failed to persist clarification response' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          await serviceClient
            .from('ai_chat_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', sessionId)
            .eq('user_id', user.id);

          return new Response(
            JSON.stringify({
              sessionId,
              answer: clarificationInsert.data.content,
              metadata: clarificationInsert.data.metadata,
              messageId: clarificationInsert.data.id,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        if (nameResolution.match) {
          targetProfile = nameResolution.match;
        } else if (asksForAllPeople(question)) {
          targetProfile = null;
        } else if (parseReferenceToPreviousPerson(question) || followUpQuestion) {
          const fromTargetUserId = priorContext.targetUserId
            ? (profiles as ProfileRow[]).find((p) => p.id === priorContext.targetUserId)
            : null;

          if (fromTargetUserId) {
            targetProfile = fromTargetUserId;
          } else if (priorContext.subject) {
            const fromHistorySubject = (profiles as ProfileRow[]).find(
              (p) => (p.full_name || '').toLowerCase() === priorContext.subject?.toLowerCase()
            );

            if (fromHistorySubject) {
              targetProfile = fromHistorySubject;
            }
          }
        }
      }
    }

    if (!isPrivileged) {
      targetProfile = {
        id: currentProfile.id,
        full_name: currentProfile.full_name,
        role: currentProfile.role,
      };
    }

    const toolRegistry = buildToolRegistry();
    const toolCallRecords: AskToolCallRecord[] = [];

    const runTool = async (tool: AskToolName, args: Record<string, unknown>) => {
      toolCallRecords.push({ tool, args });
      const ctx: AskToolContext = {
        serviceClient,
        startDate,
        endDate,
        targetUserId: targetProfile?.id || null,
        isPrivileged,
        fallbackUserId: user.id,
      };

      return toolRegistry[tool](args, ctx);
    };

    const subjectLabel = targetProfile?.full_name || (isPrivileged ? 'everyone' : currentProfile.full_name || 'you');
    let answer = '';
    let metadata: Record<string, unknown> = {
      intent,
      subject: subjectLabel,
      targetUserId: targetProfile?.id || null,
      startDate,
      endDate,
      rangeLabel: label,
      mcpMode: 'planned-hosted-supabase-mcp',
    };

    let typedEntries: TimeEntryRow[] = [];
    if (intent === 'hours_summary' || intent === 'locations_summary' || intent === 'locations_chart') {
      const entriesResult = await runTool('fetch_time_entries', {});
      typedEntries = (entriesResult.entries || []) as TimeEntryRow[];
      metadata = {
        ...metadata,
        source: 'time_entries',
      };
    }

    let typedExpenses: ExpenseRow[] = [];
    if (intent === 'expenses_count' || intent === 'expenses_total' || intent === 'expenses_by_job') {
      const expensesResult = await runTool('fetch_expenses', {});
      typedExpenses = (expensesResult.expenses || []) as ExpenseRow[];
      metadata = {
        ...metadata,
        source: 'expenses',
      };
    }

    let typedInvoices: InvoiceRow[] = [];
    if (intent === 'invoices_count' || intent === 'invoices_total' || intent === 'invoices_outstanding') {
      const invoicesResult = await runTool('fetch_invoices', {});
      typedInvoices = (invoicesResult.invoices || []) as InvoiceRow[];
      metadata = {
        ...metadata,
        source: 'invoices',
      };
    }

    if (intent === 'hours_summary') {
      const result = await runTool('compute_hours_summary', {
        entries: typedEntries,
        subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
      });

      answer = String(result.answer || 'No answer available.');
      metadata = {
        ...metadata,
        totalHours: Number(result.totalHours || 0),
        entryCount: Number(result.entryCount || 0),
      };

      const concise = await runTool('compose_concise_summary', {
        intent,
        subject: subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
        totalHours: metadata.totalHours,
      });
      answer = String(concise.summary || answer);
    }

    if (intent === 'locations_summary') {
      const result = await runTool('compute_locations_summary', {
        entries: typedEntries,
        subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
        allPeople: isPrivileged && targetProfile === null,
      });

      answer = String(result.answer || 'No answer available.');
      metadata = {
        ...metadata,
        totalHours: Number(result.totalHours || 0),
        locationCount: Number(result.locationCount || 0),
        locations: result.locations || [],
        byPerson: result.byPerson || [],
      };

      const concise = await runTool('compose_concise_summary', {
        intent,
        subject: subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
        locationCount: metadata.locationCount,
        byPerson: metadata.byPerson,
      });
      answer = String(concise.summary || answer);
    }

    if (intent === 'locations_chart') {
      const result = await runTool('compute_locations_chart', {
        entries: typedEntries,
        subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
      });

      answer = String(result.answer || 'No answer available.');
      metadata = {
        ...metadata,
        totalHours: Number(result.totalHours || 0),
        locationCount: Number(result.locationCount || 0),
        locations: result.locations || [],
        chart: result.chart || null,
      };

      const concise = await runTool('compose_concise_summary', {
        intent,
        subject: subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
        locationCount: metadata.locationCount,
      });
      answer = String(concise.summary || answer);
    }

    if (intent === 'expenses_count') {
      const result = await runTool('compute_expenses_count', {
        expenses: typedExpenses,
        subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
      });

      answer = String(result.answer || 'No answer available.');
      metadata = {
        ...metadata,
        expenseCount: Number(result.count || 0),
        totalExpenseAmount: Number(result.totalAmount || 0),
      };

      const concise = await runTool('compose_concise_summary', {
        intent,
        subject: subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
        expenseCount: metadata.expenseCount,
      });
      answer = String(concise.summary || answer);
    }

    if (intent === 'expenses_total') {
      const result = await runTool('compute_expenses_total', {
        expenses: typedExpenses,
        subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
      });

      answer = String(result.answer || 'No answer available.');
      metadata = {
        ...metadata,
        expenseCount: Number(result.count || 0),
        totalExpenseAmount: Number(result.totalAmount || 0),
      };

      const concise = await runTool('compose_concise_summary', {
        intent,
        subject: subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
        totalExpenseAmount: metadata.totalExpenseAmount,
      });
      answer = String(concise.summary || answer);
    }

    if (intent === 'expenses_by_job') {
      const result = await runTool('compute_expenses_by_job', {
        expenses: typedExpenses,
        question,
        subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
      });

      answer = String(result.answer || 'No answer available.');
      metadata = {
        ...metadata,
        expenseCount: Number(result.count || 0),
        totalExpenseAmount: Number(result.totalAmount || 0),
        location: result.location || null,
        needsClarification: Boolean(result.needsClarification || false),
        options: result.options || [],
      };

      if (!metadata.needsClarification) {
        const concise = await runTool('compose_concise_summary', {
          intent,
          subject: subjectLabel,
          rangeLabel: label,
          startDate,
          endDate,
          totalExpenseAmount: metadata.totalExpenseAmount,
          location: metadata.location,
        });
        answer = String(concise.summary || answer);
      }
    }

    if (intent === 'invoices_count') {
      const result = await runTool('compute_invoices_count', {
        invoices: typedInvoices,
        subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
      });

      answer = String(result.answer || 'No answer available.');
      metadata = {
        ...metadata,
        invoiceCount: Number(result.invoiceCount || 0),
        paidCount: Number(result.paidCount || 0),
        partialCount: Number(result.partialCount || 0),
        unpaidCount: Number(result.unpaidCount || 0),
      };

      const concise = await runTool('compose_concise_summary', {
        intent,
        subject: subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
        invoiceCount: metadata.invoiceCount,
      });
      answer = String(concise.summary || answer);
    }

    if (intent === 'invoices_total') {
      const result = await runTool('compute_invoices_total', {
        invoices: typedInvoices,
        subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
      });

      answer = String(result.answer || 'No answer available.');
      metadata = {
        ...metadata,
        invoiceCount: Number(result.invoiceCount || 0),
        totalInvoiced: Number(result.totalInvoiced || 0),
        totalPaid: Number(result.totalPaid || 0),
        outstandingTotal: Number(result.outstandingTotal || 0),
      };

      const concise = await runTool('compose_concise_summary', {
        intent,
        subject: subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
        totalInvoiced: metadata.totalInvoiced,
      });
      answer = String(concise.summary || answer);
    }

    if (intent === 'invoices_outstanding') {
      const result = await runTool('compute_invoices_outstanding', {
        invoices: typedInvoices,
        subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
      });

      answer = String(result.answer || 'No answer available.');
      metadata = {
        ...metadata,
        invoiceCount: Number(result.invoiceCount || 0),
        openInvoiceCount: Number(result.openInvoiceCount || 0),
        totalInvoiced: Number(result.totalInvoiced || 0),
        totalPaid: Number(result.totalPaid || 0),
        outstandingTotal: Number(result.outstandingTotal || 0),
        paidCount: Number(result.paidCount || 0),
        partialCount: Number(result.partialCount || 0),
        unpaidCount: Number(result.unpaidCount || 0),
      };

      const concise = await runTool('compose_concise_summary', {
        intent,
        subject: subjectLabel,
        rangeLabel: label,
        startDate,
        endDate,
        outstandingTotal: metadata.outstandingTotal,
      });
      answer = String(concise.summary || answer);
    }

    const assistantInsert = await serviceClient
      .from('ai_chat_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: 'assistant',
        content: answer,
        tool_calls: toolCallRecords,
        metadata,
      })
      .select('id, content, metadata, created_at')
      .single();

    if (assistantInsert.error || !assistantInsert.data) {
      return new Response(JSON.stringify({ error: 'Failed to persist answer' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await serviceClient
      .from('ai_chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    return new Response(
      JSON.stringify({
        sessionId,
        answer: assistantInsert.data.content,
        metadata: assistantInsert.data.metadata,
        messageId: assistantInsert.data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('ask-ai function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
