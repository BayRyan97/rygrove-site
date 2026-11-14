import { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, X, Plus, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProjectFinancialsProps {
  projectId: string;
  currentUser: string;
  // Admins can link/unlink jobs; partners just see the numbers
  canManage: boolean;
}

interface LinkedLocation {
  id: string;
  location: string;
}

interface Totals {
  budget: number;
  labor: number;
  laborHours: number;
  materials: number;
  billed: number;
}

const EMPTY_TOTALS: Totals = { budget: 0, labor: 0, laborHours: 0, materials: 0, billed: 0 };
const PAGE_SIZE = 1000;

const currency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// Estimate versions are saved as "<job> v2", "<job> v3"…
const baseJobName = (name: string | null | undefined) => (name || '').replace(/ v\d+$/, '').trim();

// Supabase caps responses at 1000 rows, so page through.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await build(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export default function ProjectFinancials({ projectId, currentUser, canManage }: ProjectFinancialsProps) {
  const [expanded, setExpanded] = useState(true);
  const [linked, setLinked] = useState<LinkedLocation[]>([]);
  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [newLocation, setNewLocation] = useState('');
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinked = useCallback(async () => {
    const { data, error } = await supabase
      .from('planner_project_locations')
      .select('id, location')
      .eq('project_id', projectId)
      .order('location');
    if (error) {
      console.error('Error fetching project locations:', error);
      setError('Could not load linked jobs.');
      return;
    }
    setLinked(data || []);
  }, [projectId]);

  // Options for the "link a job" picker: every location used on time entries,
  // expenses or estimates.
  const fetchLocationOptions = useCallback(async () => {
    try {
      const [entryRows, expenseRows, estimateRows] = await Promise.all([
        fetchAll<{ location: string | null }>((from, to) =>
          supabase.from('time_entries').select('location').not('location', 'is', null).range(from, to)),
        fetchAll<{ location: string | null }>((from, to) =>
          supabase.from('expenses').select('location').not('location', 'is', null).range(from, to)),
        fetchAll<{ job_name: string | null }>((from, to) =>
          supabase.from('estimate_worksheets').select('job_name').range(from, to))
      ]);
      const names = new Set<string>();
      entryRows.forEach(r => r.location?.trim() && names.add(r.location.trim()));
      expenseRows.forEach(r => r.location?.trim() && names.add(r.location.trim()));
      estimateRows.forEach(r => baseJobName(r.job_name) && names.add(baseJobName(r.job_name)));
      setAllLocations(Array.from(names).sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error('Error fetching location options:', err);
    }
  }, []);

  // Totals come from a database function so partners can see them without
  // access to individual time entries, pay rates, estimates or invoices.
  const fetchTotals = useCallback(async (locations: string[]) => {
    if (locations.length === 0) {
      setTotals(EMPTY_TOTALS);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('planner_project_financials', { p_project_id: projectId });
    if (error) {
      console.error('Error calculating project financials:', error);
      setError('Could not load project costs.');
    } else {
      const row = (Array.isArray(data) ? data[0] : data) || {};
      setTotals({
        budget: Number(row.budget || 0),
        labor: Number(row.labor || 0),
        laborHours: Number(row.labor_hours || 0),
        materials: Number(row.materials || 0),
        billed: Number(row.billed || 0)
      });
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    setLinked([]);
    setTotals(EMPTY_TOTALS);
    fetchLinked();
  }, [fetchLinked]);

  useEffect(() => {
    if (canManage) fetchLocationOptions();
  }, [canManage, fetchLocationOptions]);

  const linkedNames = useMemo(() => linked.map(l => l.location), [linked]);

  useEffect(() => {
    fetchTotals(linkedNames);
  }, [linkedNames, fetchTotals]);

  const addLocation = async () => {
    const location = newLocation.trim();
    if (!location || linkedNames.includes(location)) {
      setNewLocation('');
      return;
    }
    const { error } = await supabase
      .from('planner_project_locations')
      .insert([{ project_id: projectId, location, created_by: currentUser || null }]);
    if (error) {
      console.error('Error linking location:', error);
      alert(`Could not link job: ${error.message}`);
      return;
    }
    setNewLocation('');
    await fetchLinked();
  };

  const removeLocation = async (id: string) => {
    const { error } = await supabase.from('planner_project_locations').delete().eq('id', id);
    if (error) {
      console.error('Error unlinking location:', error);
      alert(`Could not remove job: ${error.message}`);
      return;
    }
    await fetchLinked();
  };

  const spent = totals.labor + totals.materials;
  const margin = totals.billed - spent;
  const budgetUsed = totals.budget > 0 ? spent / totals.budget : null;
  const barColor = budgetUsed === null ? 'bg-gray-300' : budgetUsed >= 1 ? 'bg-red-500' : budgetUsed >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500';
  const availableOptions = allLocations.filter(l => !linkedNames.includes(l));

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-3 border border-emerald-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1">
          <DollarSign size={14} />
          Project Costs
        </h3>
        {expanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-3">
          {/* Linked jobs */}
          <div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {linked.map(l => (
                <span key={l.id} className="inline-flex items-center gap-1 bg-white border border-emerald-200 rounded-full pl-2 pr-1 py-0.5 text-[11px] text-gray-800">
                  <MapPin size={10} className="text-emerald-600" />
                  {l.location}
                  {canManage && <button onClick={() => removeLocation(l.id)} className="p-0.5 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600" title="Unlink job">
                    <X size={10} />
                  </button>}
                </span>
              ))}
              {linked.length === 0 && (
                <span className="text-[11px] text-gray-600">
                  {canManage
                    ? 'Link this project to its job so time, expenses, estimates and invoices roll up here.'
                    : 'No job has been linked to this project yet.'}
                </span>
              )}
            </div>
            {canManage && <div className="flex gap-1.5 mt-2">
              <input
                list={`project-locations-${projectId}`}
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLocation()}
                placeholder="Link a job / location…"
                className="flex-1 min-w-0 px-2 py-1 border rounded text-xs focus:ring-2 focus:ring-emerald-500 bg-white"
              />
              <datalist id={`project-locations-${projectId}`}>
                {availableOptions.map(l => <option key={l} value={l} />)}
              </datalist>
              <button
                onClick={addLocation}
                disabled={!newLocation.trim()}
                className="flex items-center px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 text-[10px]"
              >
                <Plus size={12} className="mr-1" />
                Link
              </button>
            </div>}
          </div>

          {error && <div className="text-[11px] text-red-600">{error}</div>}

          {linked.length > 0 && (
            <>
              <div className={`grid grid-cols-2 sm:grid-cols-5 gap-2 ${loading ? 'opacity-50' : ''}`}>
                <Stat label="Budget" value={totals.budget > 0 ? currency(totals.budget) : '—'} hint={totals.budget > 0 ? 'Latest estimate' : 'No estimate found'} />
                <Stat label="Labor" value={currency(totals.labor)} hint={`${totals.laborHours.toFixed(1)} hrs`} />
                <Stat label="Materials" value={currency(totals.materials)} hint="Expenses" />
                <Stat label="Billed" value={currency(totals.billed)} hint="Finalized invoices" />
                <Stat
                  label="Margin"
                  value={currency(margin)}
                  hint="Billed − labor − materials"
                  tone={margin < 0 ? 'text-red-600' : 'text-emerald-700'}
                />
              </div>

              {budgetUsed !== null && (
                <div>
                  <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                    <span>Spent {currency(spent)} of {currency(totals.budget)} budget</span>
                    <span className={budgetUsed >= 1 ? 'text-red-600 font-semibold' : ''}>{Math.round(budgetUsed * 100)}%</span>
                  </div>
                  <div className="h-2 bg-white rounded-full overflow-hidden border border-emerald-100">
                    <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, budgetUsed * 100)}%` }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="bg-white/80 rounded-md px-2 py-1.5 border border-emerald-100">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`text-sm font-semibold ${tone || 'text-gray-900'}`}>{value}</div>
      {hint && <div className="text-[9px] text-gray-400 truncate">{hint}</div>}
    </div>
  );
}
