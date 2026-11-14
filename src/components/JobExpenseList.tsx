import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Receipt, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface JobExpenseListProps {
  // Bump to reload after new expenses are submitted
  refreshKey: number;
}

interface ExpenseRow {
  id: string;
  date: string | null;
  amount: number | string | null;
  description: string | null;
  location: string | null;
  user_id: string | null;
  receipt_image_url: string | null;
  receipt_url: string | null;
  retailers: { name: string } | null;
}

const currency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// Expenses the signed-in user is allowed to see (for partners: their shared
// jobs only — the database enforces that).
export function JobExpenseList({ refreshKey }: JobExpenseListProps) {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('id, date, amount, description, location, user_id, receipt_image_url, receipt_url, retailers(name)')
      .order('date', { ascending: false })
      .limit(500);
    if (error) {
      console.error('Error loading expenses:', error);
      setLoading(false);
      return;
    }
    const list = (data || []) as unknown as ExpenseRow[];
    setRows(list);

    const ids = Array.from(new Set(list.map(r => r.user_id).filter(Boolean))) as string[];
    if (ids.length > 0) {
      const { data: nameRows } = await supabase.rpc('get_profile_names', { p_ids: ids });
      setNames(new Map((nameRows || []).map((n: { id: string; full_name: string | null }) => [n.id, n.full_name || 'Unknown'])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Submitted Expenses</h3>
        <span className="text-sm font-semibold text-gray-700">{currency(total)}</span>
      </div>
      {loading ? (
        <div className="p-4 text-sm text-gray-500">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">No expenses submitted for this job yet.</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map(r => {
            const receipt = r.receipt_image_url || r.receipt_url;
            return (
              <li key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{r.description || 'Expense'}</div>
                  <div className="text-xs text-gray-500">
                    {[
                      r.date ? format(parseISO(r.date), 'MMM d, yyyy') : null,
                      r.retailers?.name,
                      r.location,
                      r.user_id ? names.get(r.user_id) : null
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {receipt && (
                    <a
                      href={receipt.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                      title="View receipt"
                    >
                      <Receipt size={16} className="inline" />
                      <ExternalLink size={10} className="inline ml-0.5" />
                    </a>
                  )}
                  <span className="text-sm font-semibold text-gray-900">{currency(Number(r.amount || 0))}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
