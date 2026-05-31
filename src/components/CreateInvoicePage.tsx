import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { FileSpreadsheet, Search, MapPin, ChevronDown, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateClientInvoicePDF } from '../lib/pdfExport';

interface TimeEntry {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  lunch_break: string | null;
  notes: string | null;
  user_id: string;
  full_name: string;
  is_full_day: boolean;
  rate?: number | null;
  expenses: {
    amount: number;
    description: string;
    receipt_url: string | null;
    retailer_name?: string;
  }[];
}

interface StandaloneExpense {
  id: string;
  date: string;
  amount: number;
  description: string;
  location: string;
  receipt_url: string | null;
  retailer_name?: string;
}

interface EstimateWorksheet {
  id: string;
  job_name: string;
  total: number;
  updated_at: string;
  overhead_percentage?: number;
  overhead_amount?: number;
  items: Array<{
    id: string;
    item: string;
    cost: number;
  }>;
}

interface EstimateProgressRow {
  id: string;
  sourceItemId: string;
  item: string;
  sourceValue: number;
  priorCumulativePercent: number;
  currentCumulativePercent: number;
  deltaPercent: number;
  billedAmount: number;
  isOverBilledWarning: boolean;
}

interface SavedInvoice {
  id: string;
  invoice_number: string | null;
  location: string | null;
  grand_total: number;
  amount_paid: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  status: 'draft' | 'finalized' | 'void';
  created_at: string;
}

interface LocationSummary {
  totalHours: number;
  totalExpenses: number;
  employeeHours: { [key: string]: number };
  entries: TimeEntry[];
  standaloneExpenses: StandaloneExpense[];
  estimateProgressRows: EstimateProgressRow[];
  laborCosts: { [key: string]: { hours: number; rate: number; cost: number } };
  progressBaseSubtotal: number;
  progressOverheadPercent: number;
  progressOverheadAmount: number;
  progressSubtotal: number;
  laborSubtotal: number;
  laborMarkup: number;
  laborTotal: number;
  expenseMarkup: number;
  expenseTotal: number;
  grandTotal: number;
}

export function CreateInvoicePage() {
  // Helper function to format numbers with commas
  const formatCurrency = (value: number): string => {
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [filteredLocations, setFilteredLocations] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  // Date defaults to last month
  const getLastMonthDates = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      start: format(firstDay, 'yyyy-MM-dd'),
      end: format(lastDay, 'yyyy-MM-dd')
    };
  };
  
  const lastMonth = getLastMonthDates();
  const [startDate, setStartDate] = useState(lastMonth.start);
  const [endDate, setEndDate] = useState(lastMonth.end);
  const [datePreset, setDatePreset] = useState('last-month');
  
  const [isLoading, setIsLoading] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [standaloneExpenses, setStandaloneExpenses] = useState<StandaloneExpense[]>([]);
  const [estimateWorksheets, setEstimateWorksheets] = useState<EstimateWorksheet[]>([]);
  const [selectedEstimateId, setSelectedEstimateId] = useState('');
  const [estimateSearchTerm, setEstimateSearchTerm] = useState('');
  const [filteredEstimates, setFilteredEstimates] = useState<EstimateWorksheet[]>([]);
  const [highlightedEstimateIndex, setHighlightedEstimateIndex] = useState(-1);
  const [estimateProgressRows, setEstimateProgressRows] = useState<EstimateProgressRow[]>([]);
  const [estimateContractTotalProposed, setEstimateContractTotalProposed] = useState(0);
  const [estimateOverheadPercent, setEstimateOverheadPercent] = useState(0);
  const [progressPercentInputs, setProgressPercentInputs] = useState<{ [key: string]: string }>({});
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showEstimateDropdown, setShowEstimateDropdown] = useState(false);
  
  // Markup and rate override state
  const [laborMarkupPercent, setLaborMarkupPercent] = useState(20);
  const [expenseMarkupPercent, setExpenseMarkupPercent] = useState(15);
  const [enableRateOverrides, setEnableRateOverrides] = useState(false);
  const [excludeLaborCosts, setExcludeLaborCosts] = useState(false);
  const [rateOverrides, setRateOverrides] = useState<{[userId: string]: number}>({});
  const [invoiceVault, setInvoiceVault] = useState<SavedInvoice[]>([]);
  const [selectedVaultInvoiceId, setSelectedVaultInvoiceId] = useState('');
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [isVaultLoading, setIsVaultLoading] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);

  useEffect(() => {
    fetchLocations();
    fetchEstimateWorksheets();
    fetchInvoiceVault();
  }, []);

  useEffect(() => {
    fetchInvoiceVault();
  }, [selectedLocation]);

  // Filter locations based on search input
  useEffect(() => {
    if (selectedLocation.trim()) {
      const filtered = locations.filter(loc =>
        loc.toLowerCase().includes(selectedLocation.toLowerCase())
      );
      setFilteredLocations(filtered);
      setHighlightedIndex(0);
    } else {
      setFilteredLocations(locations);
      setHighlightedIndex(-1);
    }
  }, [selectedLocation, locations]);

  // Filter estimates based on search input
  useEffect(() => {
    if (estimateSearchTerm.trim()) {
      const filtered = estimateWorksheets.filter((estimate) =>
        estimate.job_name.toLowerCase().includes(estimateSearchTerm.toLowerCase())
      );
      setFilteredEstimates(filtered);
      setHighlightedEstimateIndex(0);
    } else {
      setFilteredEstimates(estimateWorksheets);
      setHighlightedEstimateIndex(-1);
    }
  }, [estimateSearchTerm, estimateWorksheets]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.location-dropdown-container') && !target.closest('.estimate-dropdown-container')) {
        setShowLocationDropdown(false);
          setShowEstimateDropdown(false);
      }
    };

      if (showLocationDropdown || showEstimateDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    }, [showLocationDropdown, showEstimateDropdown]);

  const handleLocationKeyDown = (e: React.KeyboardEvent) => {
    if (!showLocationDropdown) {
      if (e.key === 'ArrowDown') {
        setShowLocationDropdown(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredLocations.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredLocations.length) {
          setSelectedLocation(filteredLocations[highlightedIndex]);
          setShowLocationDropdown(false);
          setHighlightedIndex(-1);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowLocationDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const fetchLocations = async () => {
    try {
      // Fetch ALL time entries using pagination to bypass 1000 row limit
      let allEntries: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('time_entries')
          .select('location')
          .not('location', 'is', null)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allEntries = [...allEntries, ...data];
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      const locationsFromEntries = Array.from(new Set(allEntries.map(entry => entry.location)));

      // Also fetch saved estimate job names and include them as possible locations
      const { data: estimateData, error: estimateError } = await supabase
        .from('estimate_worksheets')
        .select('job_name');

      if (estimateError) {
        console.error('Error fetching estimates for locations:', estimateError);
      }

      const estimateNames: string[] = (estimateData || [])
        .map((e: any) => (e.job_name || '').replace(/ v\d+$/, ''))
        .filter((n: string) => n && n.trim().length > 0);

      const combined = Array.from(new Set([...locationsFromEntries, ...estimateNames])).sort();
      setLocations(combined);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchEstimateWorksheets = async () => {
    try {
      // Fetch all worksheets via pagination to avoid row limits.
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;
      let allWorksheets: EstimateWorksheet[] = [];

      while (hasMore) {
        const { data, error } = await supabase
          .from('estimate_worksheets')
          .select('id, job_name, total, items, updated_at')
          .order('updated_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        const batch = (data as EstimateWorksheet[]) || [];
        allWorksheets = [...allWorksheets, ...batch];
        hasMore = batch.length === pageSize;
        page += 1;
      }

      // De-duplicate defensively and sort latest first.
      const uniqueById = new Map<string, EstimateWorksheet>();
      allWorksheets.forEach((worksheet) => uniqueById.set(worksheet.id, worksheet));

      const sorted = Array.from(uniqueById.values()).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setEstimateWorksheets(sorted);
    } catch (error) {
      console.error('Error fetching estimate worksheets:', error);
    }
  };

  const fetchInvoiceVault = async () => {
    setIsVaultLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select('id, invoice_number, location, grand_total, amount_paid, payment_status, status, created_at')
        .eq('status', 'finalized')
        .order('created_at', { ascending: false })
        .limit(200);

      if (selectedLocation.trim()) {
        query = query.eq('location', selectedLocation.trim());
      }

      const { data, error } = await query;
      if (error) throw error;

      setInvoiceVault((data || []) as SavedInvoice[]);

      if (selectedVaultInvoiceId) {
        const stillExists = (data || []).some((invoice: any) => invoice.id === selectedVaultInvoiceId);
        if (!stillExists) {
          setSelectedVaultInvoiceId('');
          setPaymentAmountInput('');
        }
      }
    } catch (error) {
      console.error('Error fetching invoice vault:', error);
    } finally {
      setIsVaultLoading(false);
    }
  };

  const handleEstimateKeyDown = (e: React.KeyboardEvent) => {
    if (!showEstimateDropdown) {
      if (e.key === 'ArrowDown') {
        setShowEstimateDropdown(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedEstimateIndex((prev) =>
          prev < filteredEstimates.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedEstimateIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedEstimateIndex >= 0 && highlightedEstimateIndex < filteredEstimates.length) {
          const selectedEstimate = filteredEstimates[highlightedEstimateIndex];
          setSelectedEstimateId(selectedEstimate.id);
          setEstimateSearchTerm(selectedEstimate.job_name);
          setShowEstimateDropdown(false);
          setHighlightedEstimateIndex(-1);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowEstimateDropdown(false);
        setHighlightedEstimateIndex(-1);
        break;
    }
  };

  const fetchEstimateProgressRows = async (estimateId: string) => {
    if (!estimateId) {
      setEstimateProgressRows([]);
      setEstimateContractTotalProposed(0);
      setEstimateOverheadPercent(0);
      return;
    }

    try {
      const { data: estimateData, error: estimateError } = await supabase
        .from('estimate_worksheets')
        .select('id, job_name, total, items, overhead_percentage, overhead_amount')
        .eq('id', estimateId)
        .single();

      if (estimateError) throw estimateError;

      const baseItems = Array.isArray(estimateData.items) ? estimateData.items : [];
      const estimateTotal = Number(estimateData.total);
      const overheadPercentage = Number(estimateData.overhead_percentage);
      setEstimateContractTotalProposed(Number.isFinite(estimateTotal) ? Math.max(0, estimateTotal) : 0);
      setEstimateOverheadPercent(Number.isFinite(overheadPercentage) ? Math.max(0, overheadPercentage) : 0);

      const items = baseItems;

      // If persistence tables are not deployed yet, this query will fail and fallback to 0% defaults.
      const latestLineByItem: {
        [itemId: string]: {
          prior: number;
          current: number;
          delta: number;
          billed: number;
          warning: boolean;
        };
      } = {};
      const latestBillableLineByItem: {
        [itemId: string]: {
          prior: number;
          current: number;
          delta: number;
          billed: number;
          warning: boolean;
        };
      } = {};
      const { data: priorData, error: priorError } = await supabase
        .from('invoice_estimate_lines')
        .select(
          'source_item_id, prior_cumulative_percent, current_cumulative_percent, delta_percent, billed_amount, warning_over_100, created_at'
        )
        .eq('estimate_worksheet_id', estimateId);

      if (!priorError && priorData) {
        priorData
          .slice()
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .forEach((row: any) => {
            const itemId = row.source_item_id;
            if (latestLineByItem[itemId] !== undefined) return;

            const prior = Number(row.prior_cumulative_percent) || 0;
            const current = Number(row.current_cumulative_percent);
            const safeCurrent = Number.isFinite(current) ? current : prior;
            const delta = Number(row.delta_percent);
            const safeDelta = Number.isFinite(delta) ? delta : Math.max(0, safeCurrent - prior);
            const billed = Number(row.billed_amount);
            const safeBilled = Number.isFinite(billed) ? billed : 0;
            const safeWarning = Boolean(row.warning_over_100) || safeCurrent > 100;

            const normalized = {
              prior,
              current: safeCurrent,
              delta: safeDelta,
              billed: safeBilled,
              warning: safeWarning,
            };

            latestLineByItem[itemId] = normalized;
            if (latestBillableLineByItem[itemId] === undefined && (safeBilled > 0 || safeDelta > 0)) {
              latestBillableLineByItem[itemId] = normalized;
            }
          });
      }

      const nextRows: EstimateProgressRow[] = items.map((item: any, index: number) => {
        const itemId = String(item.id || `item-${index + 1}`);
        const sourceValue = Number(item.cost) || 0;
        const latest = latestLineByItem[itemId];
        const latestBillable = latestBillableLineByItem[itemId];

        let resolved = latest;
        if (
          latest &&
          latestBillable &&
          latest.billed <= 0 &&
          latest.delta <= 0 &&
          latest.current === latest.prior
        ) {
          // Re-opened invoice with no edits should keep the most recent billed values.
          resolved = latestBillable;
        }

        const priorCumulativePercent = resolved?.prior ?? 0;
        const currentCumulativePercent = resolved?.current ?? priorCumulativePercent;
        const deltaPercent = resolved?.delta ?? 0;
        const isNoChangeSnapshot =
          currentCumulativePercent === priorCumulativePercent &&
          deltaPercent <= 0 &&
          (resolved?.billed ?? 0) <= 0;
        const billedAmount =
          (resolved?.billed ?? 0) > 0
            ? (resolved?.billed ?? 0)
            : isNoChangeSnapshot
              ? (priorCumulativePercent / 100) * sourceValue
              : (deltaPercent / 100) * sourceValue;
        const isOverBilledWarning = resolved?.warning ?? currentCumulativePercent > 100;

        return {
          id: `${estimateId}-${itemId}`,
          sourceItemId: itemId,
          item: String(item.item || `Estimate Line ${index + 1}`),
          sourceValue,
          priorCumulativePercent,
          currentCumulativePercent,
          deltaPercent,
          billedAmount,
          isOverBilledWarning,
        };
      });

      setEstimateProgressRows(nextRows);
      setProgressPercentInputs({});
    } catch (error) {
      console.error('Error fetching estimate progress rows:', error);
      setEstimateProgressRows([]);
      setEstimateContractTotalProposed(0);
      setEstimateOverheadPercent(0);
    }
  };

  const handleSearchRecords = async () => {
    if (!selectedLocation && !selectedEstimateId) return;

    setIsLoading(true);
    try {
      await Promise.all([
        selectedLocation ? fetchTimeEntries() : Promise.resolve(),
        selectedEstimateId ? fetchEstimateProgressRows(selectedEstimateId) : Promise.resolve(),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProgressPercent = (rowId: string, value: string) => {
    setProgressPercentInputs((prev) => ({
      ...prev,
      [rowId]: value,
    }));

    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const sanitized = Math.max(0, parsed);
    setEstimateProgressRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id !== rowId) return row;

        const deltaPercent = Math.max(0, sanitized - row.priorCumulativePercent);
        return {
          ...row,
          currentCumulativePercent: sanitized,
          deltaPercent,
          billedAmount: (deltaPercent / 100) * row.sourceValue,
          isOverBilledWarning: sanitized > 100,
        };
      })
    );
  };

  const commitProgressPercent = async (rowId: string) => {
    const rawInput = progressPercentInputs[rowId];
    if (rawInput === undefined) return;

    const parsed = Number.parseFloat(rawInput);
    if (!Number.isFinite(parsed)) {
      setProgressPercentInputs((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
      return;
    }

    const sanitized = Math.max(0, parsed);
    const nextRows = estimateProgressRows.map((row) => {
      if (row.id !== rowId) return row;

      const deltaPercent = Math.max(0, sanitized - row.priorCumulativePercent);
      return {
        ...row,
        currentCumulativePercent: sanitized,
        deltaPercent,
        billedAmount: (deltaPercent / 100) * row.sourceValue,
        isOverBilledWarning: sanitized > 100,
      };
    });

    setEstimateProgressRows(nextRows);

    setProgressPercentInputs((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });

    try {
      await persistProgressBillingSnapshot(nextRows);
    } catch (error) {
      console.error('Error auto-saving progress billing snapshot:', error);
    }
  };

  const resetProgressPercent = async (rowId: string) => {
    const nextRows = estimateProgressRows.map((row) => {
      if (row.id !== rowId) return row;

      return {
        ...row,
        currentCumulativePercent: 0,
        deltaPercent: 0,
        billedAmount: 0,
        isOverBilledWarning: false,
      };
    });

    setEstimateProgressRows(nextRows);
    setProgressPercentInputs((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });

    try {
      await persistProgressBillingSnapshot(nextRows);
    } catch (error) {
      console.error('Error resetting progress billing snapshot:', error);
    }
  };

  const resetAllPriorCumulative = async () => {
    if (estimateProgressRows.length === 0) return;

    const confirmed = window.confirm(
      'Reset all Prior Cumulative % values to 0? This starts the estimate billing from a clean baseline.'
    );
    if (!confirmed) return;

    const nextRows = estimateProgressRows.map((row) => ({
      ...row,
      priorCumulativePercent: 0,
      currentCumulativePercent: 0,
      deltaPercent: 0,
      billedAmount: 0,
      isOverBilledWarning: false,
    }));

    setEstimateProgressRows(nextRows);
    setProgressPercentInputs({});

    try {
      await persistProgressBillingSnapshot(nextRows);
    } catch (error) {
      console.error('Error resetting all prior cumulative values:', error);
      alert('Failed to save reset baseline. Please try again.');
    }
  };

  const persistProgressBillingSnapshot = async (
    progressRowsOverride: EstimateProgressRow[] = estimateProgressRows,
    notifyOnError = false,
    targetStatus: 'draft' | 'finalized' = 'draft'
  ): Promise<{ id: string; invoiceNumber: string | null } | null> => {
    if (!selectedEstimateId || progressRowsOverride.length === 0) {
      return null;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error('You must be signed in to save invoice progress billing.');

    const invoiceLocation = selectedLocation || estimateSearchTerm || null;
    const progressBaseSubtotal = progressRowsOverride.reduce((sum, row) => sum + row.billedAmount, 0);
    const overheadPercent = Math.max(0, estimateOverheadPercent);
    const progressOverheadAmount = progressBaseSubtotal * (overheadPercent / 100);
    const progressSubtotal = progressBaseSubtotal + progressOverheadAmount;
    const laborSubtotal = Object.values(
      timeEntries.reduce<{ [key: string]: number }>((acc, entry) => {
        const hours = calculateHours(entry);
        const effectiveRate = excludeLaborCosts
          ? 0
          : (rateOverrides[entry.user_id] ?? entry.rate ?? 0);
        acc[entry.user_id] = (acc[entry.user_id] || 0) + hours * effectiveRate;
        return acc;
      }, {})
    ).reduce((sum, cost) => sum + cost, 0) + progressSubtotal;
    const laborMarkup = laborSubtotal * (laborMarkupPercent / 100);
    const laborTotal = laborSubtotal + laborMarkup;
    const expenseSubtotal =
      timeEntries.reduce((sum, entry) => sum + entry.expenses.reduce((entrySum, exp) => entrySum + exp.amount, 0), 0) +
      standaloneExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const expenseMarkup = expenseSubtotal * (expenseMarkupPercent / 100);
    const expenseTotal = expenseSubtotal + expenseMarkup;
    const grandTotal = laborTotal + expenseTotal;

    let invoiceId: string | undefined;
    let invoiceNumber: string | null = null;

    if (targetStatus === 'draft') {
      const { data: existingInvoices, error: existingInvoiceError } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('created_by', user.id)
        .eq('estimate_worksheet_id', selectedEstimateId)
        .eq('start_date', startDate)
        .eq('end_date', endDate)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (existingInvoiceError) throw existingInvoiceError;
      invoiceId = existingInvoices?.[0]?.id as string | undefined;
      invoiceNumber = (existingInvoices?.[0] as any)?.invoice_number ?? null;
    } else {
      let finalizedQuery = supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('created_by', user.id)
        .eq('estimate_worksheet_id', selectedEstimateId)
        .eq('start_date', startDate)
        .eq('end_date', endDate)
        .eq('status', 'finalized')
        .lte('amount_paid', 0)
        .order('updated_at', { ascending: false })
        .limit(1);

      finalizedQuery = invoiceLocation ? finalizedQuery.eq('location', invoiceLocation) : finalizedQuery.is('location', null);

      const { data: existingFinalized, error: existingFinalizedError } = await finalizedQuery;
      if (existingFinalizedError) throw existingFinalizedError;

      invoiceId = existingFinalized?.[0]?.id as string | undefined;
      invoiceNumber = (existingFinalized?.[0] as any)?.invoice_number ?? null;
    }

    if (!invoiceId) {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          created_by: user.id,
          location: invoiceLocation,
          estimate_worksheet_id: selectedEstimateId,
          start_date: startDate,
          end_date: endDate,
          labor_markup_percent: laborMarkupPercent,
          expense_markup_percent: expenseMarkupPercent,
          labor_subtotal: laborSubtotal,
          progress_subtotal: progressSubtotal,
          expense_subtotal: expenseSubtotal,
          labor_total: laborTotal,
          expense_total: expenseTotal,
          grand_total: grandTotal,
          status: targetStatus,
          sent_at: targetStatus === 'finalized' ? new Date().toISOString() : null,
        })
        .select('id, invoice_number')
        .single();

      if (invoiceError) throw invoiceError;
      invoiceId = invoice.id;
      invoiceNumber = (invoice as any).invoice_number ?? null;
    } else {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          location: invoiceLocation,
          labor_markup_percent: laborMarkupPercent,
          expense_markup_percent: expenseMarkupPercent,
          labor_subtotal: laborSubtotal,
          progress_subtotal: progressSubtotal,
          expense_subtotal: expenseSubtotal,
          labor_total: laborTotal,
          expense_total: expenseTotal,
          grand_total: grandTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      if (!invoiceNumber) {
        const { data: invoiceMeta } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('id', invoiceId)
          .single();

        invoiceNumber = (invoiceMeta as any)?.invoice_number ?? null;
      }
    }

    const { error: deleteLinesError } = await supabase
      .from('invoice_estimate_lines')
      .delete()
      .eq('invoice_id', invoiceId);

    if (deleteLinesError) throw deleteLinesError;

    const lineRows = progressRowsOverride.map((row) => ({
      invoice_id: invoiceId,
      estimate_worksheet_id: selectedEstimateId,
      source_item_id: row.sourceItemId,
      source_item_label: row.item,
      source_value: row.sourceValue,
      prior_cumulative_percent: row.priorCumulativePercent,
      current_cumulative_percent: row.currentCumulativePercent,
      delta_percent: row.deltaPercent,
      billed_amount: row.billedAmount,
      warning_over_100: row.isOverBilledWarning,
    }));

    const { error: lineError } = await supabase
      .from('invoice_estimate_lines')
      .insert(lineRows);

    if (lineError) throw lineError;

    if (notifyOnError) {
      console.info('Invoice snapshot saved');
    }

    return {
      id: invoiceId,
      invoiceNumber,
    };
  };

  const fetchTimeEntries = async () => {
    if (!selectedLocation || !startDate || !endDate) return;
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          id,
          date,
          start_time,
          end_time,
          location,
          lunch_break,
          notes,
          user_id,
          is_full_day,
          profiles!inner(
            rate,
            full_name
          )
        `)
        .eq('location', selectedLocation)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      // Transform the data to include full_name and rate from profiles
      const transformedData = data?.map((entry: any) => ({
        ...entry,
        full_name: entry.profiles?.full_name || 'Unknown',
        rate: entry.profiles?.rate || 0,
        expenses: [] // Will be populated below
      })) || [];

      // Fetch expenses linked to these time entries
      if (transformedData.length > 0) {
        const timeEntryIds = transformedData.map(entry => entry.id);
        
        try {
          const { data: linkedExpensesData, error: linkedExpensesError } = await supabase
            .from('expenses')
            .select(`
              id,
              time_entry_id,
              amount,
              description,
              receipt_url,
              retailer_id,
              retailers (
                name
              )
            `)
            .in('time_entry_id', timeEntryIds);

          if (linkedExpensesError) {
            console.error('Error fetching linked expenses:', linkedExpensesError);
          } else if (linkedExpensesData) {
            // Attach expenses to their corresponding time entries
            linkedExpensesData.forEach((expense: any) => {
              const entry = transformedData.find(e => e.id === expense.time_entry_id);
              if (entry) {
                entry.expenses.push({
                  amount: expense.amount,
                  description: expense.description,
                  receipt_url: expense.receipt_url,
                  retailer_name: expense.retailers?.name || null
                });
              }
            });
          }
        } catch (err) {
          console.error('Error fetching linked expenses:', err);
        }
      }

      setTimeEntries(transformedData);

      // Fetch standalone expenses from the expenses table
      // Try with retailer join first, fallback to without if it fails
      let expensesData = null;
      let expensesError = null;
      
      try {
        const result = await supabase
          .from('expenses')
          .select(`
            id,
            date,
            amount,
            description,
            location,
            receipt_url,
            retailer_id,
            retailers (
              name
            )
          `)
          .is('time_entry_id', null)
          .eq('location', selectedLocation)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true });
        
        expensesData = result.data;
        expensesError = result.error;
      } catch (err) {
        console.error('Error fetching expenses with retailer join:', err);
        // Fallback: fetch without retailer join
        const result = await supabase
          .from('expenses')
          .select('id, date, amount, description, location, receipt_url, retailer_id')
          .is('time_entry_id', null)
          .eq('location', selectedLocation)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true });
        
        expensesData = result.data;
        expensesError = result.error;
      }

      if (expensesError) {
        console.warn('Error fetching expenses:', expensesError);
        setStandaloneExpenses([]);
      } else {
        // Transform standalone expenses data
        const transformedExpenses = expensesData?.map((expense: any) => ({
          ...expense,
          retailer_name: expense.retailers?.name || null
        })) || [];

        setStandaloneExpenses(transformedExpenses);
      }
    } catch (error) {
      console.error('Error fetching time entries:', error);
      alert('Failed to fetch time entries');
    }
  };

  // Helper function to calculate hours for a time entry
  const calculateHours = useCallback((entry: TimeEntry): number => {
    const startTime = parseISO(`2000-01-01T${entry.is_full_day ? '09:00' : entry.start_time}`);
    const endTime = parseISO(`2000-01-01T${entry.is_full_day ? '17:00' : entry.end_time}`);
    let minutes = (endTime.getTime() - startTime.getTime()) / 1000 / 60;

    if (entry.lunch_break) {
      const [hours, mins] = entry.lunch_break.split(':').map(Number);
      minutes -= (hours * 60 + mins);
    }

    return minutes / 60;
  }, []);

  const locationSummary: LocationSummary = useMemo(() => {
    const summary = timeEntries.reduce((acc: LocationSummary, entry) => {
      const hours = calculateHours(entry);

      // Update employee hours
      if (!acc.employeeHours[entry.full_name]) {
        acc.employeeHours[entry.full_name] = 0;
      }
      acc.employeeHours[entry.full_name] += hours;

      // Update totals
      acc.totalHours += hours;
      acc.totalExpenses += entry.expenses.reduce((sum, exp) => sum + exp.amount, 0);

      // Store entry
      acc.entries.push(entry);

      return acc;
    }, {
      totalHours: 0,
      totalExpenses: 0,
      employeeHours: {},
      entries: [],
      standaloneExpenses: [],
      estimateProgressRows: [],
      laborCosts: {},
      progressBaseSubtotal: 0,
      progressOverheadPercent: 0,
      progressOverheadAmount: 0,
      progressSubtotal: 0,
      laborSubtotal: 0,
      laborMarkup: 0,
      laborTotal: 0,
      expenseMarkup: 0,
      expenseTotal: 0,
      grandTotal: 0
    });

    // Add standalone expenses to the total
    summary.totalExpenses += standaloneExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    summary.standaloneExpenses = standaloneExpenses;
  summary.estimateProgressRows = estimateProgressRows;

    // Calculate labor costs with rate overrides
    const laborCosts: { [key: string]: { hours: number; rate: number; cost: number } } = {};
    
    timeEntries.forEach(entry => {
      const hours = calculateHours(entry);
      const effectiveRate = excludeLaborCosts
        ? 0
        : (rateOverrides[entry.user_id] ?? entry.rate ?? 0);
      const cost = hours * effectiveRate;
      
      if (!laborCosts[entry.user_id]) {
        laborCosts[entry.user_id] = { hours: 0, rate: effectiveRate, cost: 0 };
      }
      laborCosts[entry.user_id].hours += hours;
      laborCosts[entry.user_id].cost += cost;
      laborCosts[entry.user_id].rate = effectiveRate; // Keep the rate for display
    });

    // Progress-billing subtotal = billed base + automatic overhead/profit amount.
    const progressBaseSubtotal = estimateProgressRows.reduce((sum, row) => sum + row.billedAmount, 0);
    const progressOverheadPercent = Math.max(0, estimateOverheadPercent);
    const progressOverheadAmount = progressBaseSubtotal * (progressOverheadPercent / 100);
    const progressSubtotal = progressBaseSubtotal + progressOverheadAmount;

    // Calculate totals with markup
    const laborSubtotal = Object.values(laborCosts).reduce((sum, emp) => sum + emp.cost, 0) + progressSubtotal;
    const laborMarkup = laborSubtotal * (laborMarkupPercent / 100);
    const laborTotal = laborSubtotal + laborMarkup;
    
    const expenseSubtotal = summary.totalExpenses;
    const expenseMarkup = expenseSubtotal * (expenseMarkupPercent / 100);
    const expenseTotal = expenseSubtotal + expenseMarkup;
    
    const grandTotal = laborTotal + expenseTotal;

    return {
      ...summary,
      laborCosts,
      progressBaseSubtotal,
      progressOverheadPercent,
      progressOverheadAmount,
      progressSubtotal,
      laborSubtotal,
      laborMarkup,
      laborTotal,
      expenseMarkup,
      expenseTotal,
      grandTotal
    };
  }, [
    timeEntries,
    standaloneExpenses,
    estimateProgressRows,
    estimateOverheadPercent,
    rateOverrides,
    laborMarkupPercent,
    expenseMarkupPercent,
    calculateHours,
    excludeLaborCosts,
  ]);

  const generateClientPDF = async () => {
    const isEstimateOnlyProgressBilling = !selectedLocation.trim() && !!selectedEstimateId;
    let finalizedInvoiceNumber: string | null = null;
    try {
      const snapshot = await persistProgressBillingSnapshot(locationSummary.estimateProgressRows, true, 'finalized');
      finalizedInvoiceNumber = snapshot?.invoiceNumber ?? null;
      await fetchInvoiceVault();
    } catch (error) {
      console.error('Error saving invoice progress snapshot:', error);
      alert('Invoice generated, but the progress percentage could not be saved.');
    }

    generateClientInvoicePDF({
      location: estimateSearchTerm || selectedLocation,
      invoiceNumber: finalizedInvoiceNumber,
      showLaborSummary: !isEstimateOnlyProgressBilling,
      startDate,
      endDate,
      entries: timeEntries,
      standaloneExpenses,
      estimateProgressRows: locationSummary.estimateProgressRows,
      contractTotalProposed: estimateContractTotalProposed,
      progressBaseSubtotal: locationSummary.progressBaseSubtotal,
      progressOverheadPercent: locationSummary.progressOverheadPercent,
      progressOverheadAmount: locationSummary.progressOverheadAmount,
      progressSubtotal: locationSummary.progressSubtotal,
      laborTotal: locationSummary.laborTotal,
      expenseTotal: locationSummary.expenseTotal,
      grandTotal: locationSummary.grandTotal,
      totalHours: locationSummary.totalHours,
    });
  };

  const generateExcel = async () => {
    try {
      await persistProgressBillingSnapshot(locationSummary.estimateProgressRows, true, 'finalized');
      await fetchInvoiceVault();
    } catch (error) {
      console.error('Error saving invoice progress snapshot:', error);
      alert('Report generated, but the progress percentage could not be saved.');
    }

    const headers = [
      'Date',
      'Employee',
      'Start Time',
      'End Time',
      'Lunch Break',
      'Hours',
      'Base Rate',
      'Billing Rate',
      'Labor Cost',
      'Notes',
      'Expense Amount',
      'Expense Description',
      'Retailer',
      'Receipt URL'
    ];

    const rows: string[][] = [];

    // Add summary section with billing breakdown
    rows.push(['INVOICE SUMMARY']);
    rows.push(['Location:', selectedLocation]);
    rows.push(['Period:', `${format(parseISO(startDate), 'MM/dd/yyyy')} - ${format(parseISO(endDate), 'MM/dd/yyyy')}`]);
    rows.push(['Generated:', format(new Date(), 'MM/dd/yyyy HH:mm')]);
    rows.push(['']);
    
    // Labor breakdown
    rows.push(['LABOR BREAKDOWN']);
    rows.push(['Total Hours:', locationSummary.totalHours.toFixed(2)]);
    if (locationSummary.progressBaseSubtotal > 0) {
      rows.push(['Progress Billing Base Subtotal:', `$${locationSummary.progressBaseSubtotal.toFixed(2)}`]);
      if (locationSummary.progressOverheadPercent > 0) {
        rows.push([
          `Overhead & Profit (${locationSummary.progressOverheadPercent.toFixed(2)}%):`,
          `$${locationSummary.progressOverheadAmount.toFixed(2)}`
        ]);
      }
      rows.push(['Progress Billing Subtotal:', `$${locationSummary.progressSubtotal.toFixed(2)}`]);
    }
    rows.push(['Labor Subtotal:', `$${locationSummary.laborSubtotal.toFixed(2)}`]);
    rows.push([`Labor ${laborMarkupPercent < 0 ? 'Discount' : 'Markup'} (${Math.abs(laborMarkupPercent).toFixed(1)}%):`, `$${locationSummary.laborMarkup.toFixed(2)}`]);
    rows.push(['Labor Total:', `$${locationSummary.laborTotal.toFixed(2)}`]);
    rows.push(['']);
    
    // Expense breakdown
    if (locationSummary.totalExpenses > 0) {
      rows.push(['EXPENSE BREAKDOWN']);
      rows.push(['Expense Subtotal:', `$${locationSummary.totalExpenses.toFixed(2)}`]);
      rows.push([`Expense ${expenseMarkupPercent < 0 ? 'Discount' : 'Markup'} (${Math.abs(expenseMarkupPercent).toFixed(1)}%):`, `$${locationSummary.expenseMarkup.toFixed(2)}`]);
      rows.push(['Expense Total:', `$${locationSummary.expenseTotal.toFixed(2)}`]);
      rows.push(['']);
    }
    
    // Grand total
    rows.push(['GRAND TOTAL:', `$${locationSummary.grandTotal.toFixed(2)}`]);
    rows.push(['']);
    
    // Employee labor details
    rows.push(['EMPLOYEE LABOR DETAILS']);
    rows.push(['Employee', 'Hours', 'Base Rate', 'Billing Rate', 'Labor Cost']);
    Object.entries(locationSummary.laborCosts).forEach(([userId, labor]) => {
      const entry = timeEntries.find(e => e.user_id === userId);
      const baseRate = entry?.rate ?? 0;
      const billingRate = excludeLaborCosts ? 0 : (rateOverrides[userId] ?? baseRate);
      rows.push([
        entry?.full_name || 'Unknown',
        labor.hours.toFixed(2),
        `$${baseRate.toFixed(2)}`,
        `$${billingRate.toFixed(2)}`,
        `$${labor.cost.toFixed(2)}`
      ]);
    });
    rows.push(['']);

    if (locationSummary.estimateProgressRows.length > 0) {
      rows.push(['PROGRESS BILLING DETAILS']);
      rows.push(['Item', 'Source Value', 'Prior Cumulative %', 'Current Cumulative %', 'Delta % This Invoice', 'Billed Amount', 'Warning']);
      locationSummary.estimateProgressRows.forEach((row) => {
        rows.push([
          row.item,
          `$${row.sourceValue.toFixed(2)}`,
          `${row.priorCumulativePercent.toFixed(2)}%`,
          `${row.currentCumulativePercent.toFixed(2)}%`,
          `${row.deltaPercent.toFixed(2)}%`,
          `$${row.billedAmount.toFixed(2)}`,
          row.isOverBilledWarning ? 'Over 100% cumulative' : ''
        ]);
      });
      rows.push(['']);
    }

    rows.push(['DETAILED TIME ENTRIES']);
    rows.push(headers);

    // Add detailed entries
    locationSummary.entries.forEach(entry => {
      const hours = calculateHours(entry);
      const baseRate = entry.rate ?? 0;
      const billingRate = excludeLaborCosts ? 0 : (rateOverrides[entry.user_id] ?? baseRate);
      const laborCost = hours * billingRate;
      
      const baseRow = [
        format(parseISO(entry.date), 'MM/dd/yyyy'),
        entry.full_name,
        entry.is_full_day ? '09:00' : entry.start_time,
        entry.is_full_day ? '17:00' : entry.end_time,
        entry.lunch_break || '',
        hours.toFixed(2),
        `$${baseRate.toFixed(2)}`,
        `$${billingRate.toFixed(2)}`,
        `$${laborCost.toFixed(2)}`,
        entry.notes || ''
      ];

      if (entry.expenses.length > 0) {
        entry.expenses.forEach(expense => {
          rows.push([
            ...baseRow,
            expense.amount.toFixed(2),
            expense.description,
            expense.retailer_name || '',
            expense.receipt_url || ''
          ]);
        });
      } else {
        rows.push([...baseRow, '', '', '', '']);
      }
    });

    // Add standalone expenses section
    if (locationSummary.standaloneExpenses.length > 0) {
      rows.push(['']);
      rows.push(['ADDITIONAL EXPENSES (from Expense Worksheet)']);
      rows.push(['Date', 'Description', 'Retailer', 'Amount', 'Receipt URL']);

      locationSummary.standaloneExpenses.forEach(expense => {
        rows.push([
          format(parseISO(expense.date), 'MM/dd/yyyy'),
          expense.description,
          expense.retailer_name || '',
          expense.amount.toFixed(2),
          expense.receipt_url || ''
        ]);
      });
    }

    const csvContent = rows.map(row =>
      row.map(cell => typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `invoice-${selectedLocation}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedVaultInvoice = invoiceVault.find((invoice) => invoice.id === selectedVaultInvoiceId) || null;

  const recordInvoicePayment = async () => {
    if (!selectedVaultInvoice) return;

    const parsed = Number.parseFloat(paymentAmountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert('Enter a valid payment amount greater than 0.');
      return;
    }

    const paymentToApply = Math.max(0, parsed);
    const newAmountPaid = Math.min(selectedVaultInvoice.grand_total, selectedVaultInvoice.amount_paid + paymentToApply);
    const nextStatus: 'unpaid' | 'partial' | 'paid' =
      newAmountPaid <= 0
        ? 'unpaid'
        : newAmountPaid >= selectedVaultInvoice.grand_total
          ? 'paid'
          : 'partial';

    setIsSavingPayment(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          payment_status: nextStatus,
          paid_at: nextStatus === 'paid' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedVaultInvoice.id);

      if (error) throw error;

      setPaymentAmountInput('');
      await fetchInvoiceVault();
    } catch (error) {
      console.error('Error recording invoice payment:', error);
      alert('Failed to record payment. Please try again.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const deleteVaultInvoice = async () => {
    if (!selectedVaultInvoice) return;

    const confirmed = window.confirm(
      `Delete invoice ${selectedVaultInvoice.invoice_number || selectedVaultInvoice.id}? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeletingInvoice(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', selectedVaultInvoice.id);

      if (error) throw error;

      setSelectedVaultInvoiceId('');
      setPaymentAmountInput('');
      await fetchInvoiceVault();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice. Please try again.');
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="location-dropdown-container">
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  setShowLocationDropdown(true);
                }}
                onKeyDown={handleLocationKeyDown}
                onFocus={() => setShowLocationDropdown(true)}
                className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Type to search locations..."
              />
              <ChevronDown
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                size={20}
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              />
              {showLocationDropdown && filteredLocations.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                  {filteredLocations.map((loc, index) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        setSelectedLocation(loc);
                        setShowLocationDropdown(false);
                        setHighlightedIndex(-1);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${
                        index === highlightedIndex ? 'bg-blue-50' : ''
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
              {showLocationDropdown && filteredLocations.length === 0 && selectedLocation && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 text-sm text-gray-500">
                  No locations found matching "{selectedLocation}"
                </div>
              )}
            </div>
          </div>

          <div className="estimate-dropdown-container">
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimate Version (Optional)</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={estimateSearchTerm}
                onChange={(e) => {
                  setEstimateSearchTerm(e.target.value);
                  setSelectedEstimateId('');
                  setShowEstimateDropdown(true);
                }}
                onKeyDown={handleEstimateKeyDown}
                onFocus={() => {
                  fetchEstimateWorksheets();
                  setShowEstimateDropdown(true);
                }}
                className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Type to search estimate versions..."
              />
              <ChevronDown
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                size={20}
                onClick={() => {
                  fetchEstimateWorksheets();
                  setShowEstimateDropdown(!showEstimateDropdown);
                }}
              />
              {showEstimateDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEstimateId('');
                      setEstimateSearchTerm('');
                      setShowEstimateDropdown(false);
                      setHighlightedEstimateIndex(-1);
                    }}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${
                      highlightedEstimateIndex === -1 ? 'bg-blue-50' : ''
                    }`}
                  >
                    No estimate progress billing
                  </button>
                  {filteredEstimates.map((estimate, index) => (
                    <button
                      key={estimate.id}
                      type="button"
                      onClick={() => {
                        setSelectedEstimateId(estimate.id);
                        setEstimateSearchTerm(estimate.job_name);
                        setShowEstimateDropdown(false);
                        setHighlightedEstimateIndex(-1);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${
                        index === highlightedEstimateIndex ? 'bg-blue-50' : ''
                      }`}
                    >
                      {estimate.job_name}
                    </button>
                  ))}
                  {filteredEstimates.length === 0 && estimateSearchTerm && (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      No estimate versions found matching "{estimateSearchTerm}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="flex gap-2">
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    setStartDate(format(firstDay, 'yyyy-MM-dd'));
                    setEndDate(format(lastDay, 'yyyy-MM-dd'));
                    setDatePreset('this-month');
                  }}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    datePreset === 'this-month' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700' 
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const dates = getLastMonthDates();
                    setStartDate(dates.start);
                    setEndDate(dates.end);
                    setDatePreset('last-month');
                  }}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    datePreset === 'last-month' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700' 
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const firstDay = new Date(today.getFullYear(), today.getMonth() - 2, 1);
                    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    setStartDate(format(firstDay, 'yyyy-MM-dd'));
                    setEndDate(format(lastDay, 'yyyy-MM-dd'));
                    setDatePreset('last-3-months');
                  }}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    datePreset === 'last-3-months' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700' 
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Last 3 Months
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset('custom')}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    datePreset === 'custom' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700' 
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>
            
            {datePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSearchRecords}
            disabled={(!selectedLocation && !selectedEstimateId) || isLoading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Load Billing Data
              </>
            )}
          </button>
          {(selectedLocation || selectedEstimateId || timeEntries.length > 0 || estimateProgressRows.length > 0) && (
            <button
              onClick={() => {
                setSelectedLocation('');
                setSelectedEstimateId('');
                setEstimateSearchTerm('');
                setTimeEntries([]);
                setStandaloneExpenses([]);
                setEstimateProgressRows([]);
                setEstimateContractTotalProposed(0);
                setEstimateOverheadPercent(0);
                setProgressPercentInputs({});
                setRateOverrides({});
                setEnableRateOverrides(false);
                setExcludeLaborCosts(false);
                const dates = getLastMonthDates();
                setStartDate(dates.start);
                setEndDate(dates.end);
                setDatePreset('last-month');
                setShowLocationDropdown(false);
                setShowEstimateDropdown(false);
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-4 border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Vault</label>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select
              value={selectedVaultInvoiceId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedVaultInvoiceId(nextId);
                const selected = invoiceVault.find((invoice) => invoice.id === nextId);
                if (selected) {
                  const remaining = Math.max(0, selected.grand_total - selected.amount_paid);
                  setPaymentAmountInput(remaining > 0 ? remaining.toFixed(2) : '');
                } else {
                  setPaymentAmountInput('');
                }
              }}
              className="md:col-span-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select saved invoice...</option>
              {invoiceVault.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {(invoice.invoice_number || 'No #')} - {(invoice.location || 'No Location')} - ${invoice.grand_total.toFixed(2)} ({invoice.payment_status})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentAmountInput}
              onChange={(e) => setPaymentAmountInput(e.target.value)}
              placeholder="Payment received"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!selectedVaultInvoice}
            />
            <button
              type="button"
              onClick={recordInvoicePayment}
              disabled={!selectedVaultInvoice || isSavingPayment || isDeletingInvoice}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSavingPayment ? 'Saving...' : 'Mark Paid'}
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={deleteVaultInvoice}
              disabled={!selectedVaultInvoice || isSavingPayment || isDeletingInvoice}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isDeletingInvoice ? 'Deleting...' : 'Delete Invoice'}
            </button>
          </div>
          {selectedVaultInvoice && (
            <p className="mt-2 text-xs text-gray-600">
              Invoice {selectedVaultInvoice.invoice_number || 'No #'} • Total: ${selectedVaultInvoice.grand_total.toFixed(2)} • Paid: ${selectedVaultInvoice.amount_paid.toFixed(2)} • Remaining: ${Math.max(0, selectedVaultInvoice.grand_total - selectedVaultInvoice.amount_paid).toFixed(2)}
            </p>
          )}
          {isVaultLoading && <p className="mt-2 text-xs text-gray-500">Loading invoice vault...</p>}
        </div>
        
        {locations.length > 0 && !selectedLocation && (
          <div className="mt-3 text-sm text-gray-500">
            {locations.length} location{locations.length === 1 ? '' : 's'} available
          </div>
        )}
      </div>

      {(timeEntries.length > 0 || estimateProgressRows.length > 0) && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{selectedLocation || 'Hybrid Invoice'}</h2>
              <p className="text-sm text-gray-500">
                {format(parseISO(startDate), 'MMMM d, yyyy')} - {format(parseISO(endDate), 'MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={generateClientPDF}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                Client Invoice (PDF)
              </button>
              <button
                onClick={generateExcel}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Detailed Report (CSV)
              </button>
            </div>
          </div>

          {/* Invoice Settings */}
          <div className="bg-gradient-to-br from-white to-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Invoice Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Labor Markup %
                </label>
                <input
                  type="number"
                  value={laborMarkupPercent}
                  onChange={(e) => setLaborMarkupPercent(parseFloat(e.target.value) || 0)}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val < -100) setLaborMarkupPercent(0);
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Expense Markup %
                </label>
                <input
                  type="number"
                  value={expenseMarkupPercent}
                  onChange={(e) => setExpenseMarkupPercent(parseFloat(e.target.value) || 0)}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val < -100) setExpenseMarkupPercent(0);
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableRateOverrides}
                    onChange={(e) => setEnableRateOverrides(e.target.checked)}
                    disabled={excludeLaborCosts}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable per-employee rate overrides</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeLaborCosts}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setExcludeLaborCosts(isChecked);
                      if (isChecked) {
                        setEnableRateOverrides(false);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Do not include labor costs</span>
                </label>
              </div>
            </div>
          </div>

          {/* Enhanced Summary with Billing Breakdown */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 mb-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h3>
            
            {/* Labor Section */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Hours:</span>
                <span className="font-medium">{locationSummary.totalHours.toFixed(2)}</span>
              </div>
              {locationSummary.progressSubtotal > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress Billing Base Subtotal:</span>
                    <span className="font-medium">${formatCurrency(locationSummary.progressBaseSubtotal)}</span>
                  </div>
                  {locationSummary.progressOverheadPercent > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Overhead & Profit ({locationSummary.progressOverheadPercent.toFixed(2)}%):</span>
                      <span className="font-medium">${formatCurrency(locationSummary.progressOverheadAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress Billing Subtotal:</span>
                    <span className="font-medium">${formatCurrency(locationSummary.progressSubtotal)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Labor Subtotal:</span>
                <span className="font-medium">${formatCurrency(locationSummary.laborSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Labor {laborMarkupPercent < 0 ? 'Discount' : 'Markup'} ({Math.abs(laborMarkupPercent).toFixed(1)}%):
                </span>
                <span className={`font-medium ${laborMarkupPercent < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {laborMarkupPercent < 0 ? '-' : ''}${formatCurrency(Math.abs(locationSummary.laborMarkup))}
                </span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Labor Total:</span>
                <span>${formatCurrency(locationSummary.laborTotal)}</span>
              </div>
            </div>

            {/* Expenses Section */}
            {locationSummary.totalExpenses > 0 && (
              <div className="space-y-2 mb-4 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Expense Subtotal:</span>
                  <span className="font-medium">${formatCurrency(locationSummary.totalExpenses)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Expense {expenseMarkupPercent < 0 ? 'Discount' : 'Markup'} ({Math.abs(expenseMarkupPercent).toFixed(1)}%):
                  </span>
                  <span className={`font-medium ${expenseMarkupPercent < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {expenseMarkupPercent < 0 ? '-' : ''}${formatCurrency(Math.abs(locationSummary.expenseMarkup))}
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Expense Total:</span>
                  <span>${formatCurrency(locationSummary.expenseTotal)}</span>
                </div>
              </div>
            )}

            {/* Grand Total */}
            <div className="flex justify-between text-lg font-bold pt-4 border-t-2 border-gray-300">
              <span>GRAND TOTAL:</span>
              <span className="text-blue-600">${formatCurrency(locationSummary.grandTotal)}</span>
            </div>
            
            <div className="mt-4 text-xs text-gray-500">
              {Object.keys(locationSummary.employeeHours).length} employee(s) • {locationSummary.entries.length} time entr{locationSummary.entries.length === 1 ? 'y' : 'ies'} • {locationSummary.estimateProgressRows.length} progress row(s) • {locationSummary.standaloneExpenses.length} expense record(s)
            </div>
          </div>

          {locationSummary.estimateProgressRows.length > 0 && (
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-medium text-gray-900">Progress Billing (Estimate Rows)</h3>
                <button
                  type="button"
                  onClick={resetAllPriorCumulative}
                  className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded hover:bg-red-50"
                >
                  Reset All Prior Cumulative %
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Source Value</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prior Cumulative %</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Cumulative %</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Delta % This Invoice</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Billed Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {locationSummary.estimateProgressRows.map((row) => (
                      <tr key={row.id} className={row.isOverBilledWarning ? 'bg-amber-50' : ''}>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.item}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">${formatCurrency(row.sourceValue)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">{row.priorCumulativePercent.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={progressPercentInputs[row.id] ?? row.currentCumulativePercent}
                            onChange={(e) => updateProgressPercent(row.id, e.target.value)}
                            onBlur={() => commitProgressPercent(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                commitProgressPercent(row.id);
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-28 px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => resetProgressPercent(row.id)}
                            className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Reset
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">{row.deltaPercent.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">${formatCurrency(row.billedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {locationSummary.estimateProgressRows.some((row) => row.isOverBilledWarning) && (
                <p className="text-sm text-amber-700">
                  Warning: one or more rows exceed 100% cumulative billing. This is allowed but should be reviewed before sending.
                </p>
              )}
              {locationSummary.progressOverheadPercent > 0 && (
                <p className="text-sm text-gray-600">
                  Overhead & Profit ({locationSummary.progressOverheadPercent.toFixed(2)}%) is auto-calculated from this invoice's billed progress amount.
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Employee Labor Details</h3>
            {!enableRateOverrides ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(locationSummary.laborCosts).map(([userId, labor]) => {
                  const entry = timeEntries.find(e => e.user_id === userId);
                  return (
                    <div key={userId} className="p-4 border rounded-lg">
                      <div className="font-medium text-gray-900">{entry?.full_name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{labor.hours.toFixed(2)} hours @ ${labor.rate.toFixed(2)}/hr</div>
                      <div className="text-sm font-semibold text-blue-600 mt-1">${labor.cost.toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Base Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Billing Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Labor Cost</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(locationSummary.laborCosts).map(([userId, labor]) => {
                      const entry = timeEntries.find(e => e.user_id === userId);
                      const baseRate = entry?.rate ?? 0;
                      const overrideRate = rateOverrides[userId];
                      const displayRate = excludeLaborCosts ? 0 : (overrideRate ?? baseRate);
                      
                      return (
                        <tr key={userId}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {entry?.full_name || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {labor.hours.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">
                            ${baseRate.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              value={displayRate}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                  setRateOverrides(prev => ({
                                    ...prev,
                                    [userId]: val
                                  }));
                                }
                              }}
                              disabled={excludeLaborCosts}
                              className="w-24 px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                              step="0.01"
                              min="0"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                            ${labor.cost.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {locationSummary.standaloneExpenses.length > 0 && (
            <div className="space-y-4 mt-6 pt-6 border-t">
              <h3 className="text-lg font-medium text-gray-900">Additional Expenses (from Expense Worksheet)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retailer</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {locationSummary.standaloneExpenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {format(parseISO(expense.date), 'MM/dd/yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{expense.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{expense.retailer_name || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          ${expense.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {timeEntries.length === 0 && estimateProgressRows.length === 0 && !isLoading && (selectedLocation || selectedEstimateId) && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No records found for the selected criteria.</p>
        </div>
      )}
    </div>
  );
}