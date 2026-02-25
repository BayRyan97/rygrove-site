import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { FileSpreadsheet, Search, MapPin, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

interface LocationSummary {
  totalHours: number;
  totalExpenses: number;
  employeeHours: { [key: string]: number };
  entries: TimeEntry[];
  standaloneExpenses: StandaloneExpense[];
  laborCosts: { [key: string]: { hours: number; rate: number; cost: number } };
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
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  
  // Markup and rate override state
  const [laborMarkupPercent, setLaborMarkupPercent] = useState(20);
  const [expenseMarkupPercent, setExpenseMarkupPercent] = useState(15);
  const [enableRateOverrides, setEnableRateOverrides] = useState(false);
  const [rateOverrides, setRateOverrides] = useState<{[userId: string]: number}>({});

  useEffect(() => {
    fetchLocations();
  }, []);

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

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.location-dropdown-container')) {
        setShowLocationDropdown(false);
      }
    };

    if (showLocationDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLocationDropdown]);

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

  const fetchTimeEntries = async () => {
    if (!selectedLocation || !startDate || !endDate) return;

    setIsLoading(true);
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
        expenses: [] // Initialize empty expenses array
      })) || [];

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
    } finally {
      setIsLoading(false);
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
      laborCosts: {},
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

    // Calculate labor costs with rate overrides
    const laborCosts: { [key: string]: { hours: number; rate: number; cost: number } } = {};
    
    timeEntries.forEach(entry => {
      const hours = calculateHours(entry);
      const effectiveRate = rateOverrides[entry.user_id] ?? entry.rate ?? 0;
      const cost = hours * effectiveRate;
      
      if (!laborCosts[entry.user_id]) {
        laborCosts[entry.user_id] = { hours: 0, rate: effectiveRate, cost: 0 };
      }
      laborCosts[entry.user_id].hours += hours;
      laborCosts[entry.user_id].cost += cost;
      laborCosts[entry.user_id].rate = effectiveRate; // Keep the rate for display
    });

    // Calculate totals with markup
    const laborSubtotal = Object.values(laborCosts).reduce((sum, emp) => sum + emp.cost, 0);
    const laborMarkup = laborSubtotal * (laborMarkupPercent / 100);
    const laborTotal = laborSubtotal + laborMarkup;
    
    const expenseSubtotal = summary.totalExpenses;
    const expenseMarkup = expenseSubtotal * (expenseMarkupPercent / 100);
    const expenseTotal = expenseSubtotal + expenseMarkup;
    
    const grandTotal = laborTotal + expenseTotal;

    return {
      ...summary,
      laborCosts,
      laborSubtotal,
      laborMarkup,
      laborTotal,
      expenseMarkup,
      expenseTotal,
      grandTotal
    };
  }, [timeEntries, standaloneExpenses, rateOverrides, laborMarkupPercent, expenseMarkupPercent, calculateHours]);

  const generateExcel = () => {
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
      const billingRate = rateOverrides[userId] ?? baseRate;
      rows.push([
        entry?.full_name || 'Unknown',
        labor.hours.toFixed(2),
        `$${baseRate.toFixed(2)}`,
        `$${billingRate.toFixed(2)}`,
        `$${labor.cost.toFixed(2)}`
      ]);
    });
    rows.push(['']);
    rows.push(['DETAILED TIME ENTRIES']);
    rows.push(headers);

    // Add detailed entries
    locationSummary.entries.forEach(entry => {
      const hours = calculateHours(entry);
      const baseRate = entry.rate ?? 0;
      const billingRate = rateOverrides[entry.user_id] ?? baseRate;
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

          <div className="md:col-span-2">
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
            onClick={fetchTimeEntries}
            disabled={!selectedLocation || isLoading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search Records
              </>
            )}
          </button>
          {(selectedLocation || timeEntries.length > 0) && (
            <button
              onClick={() => {
                setSelectedLocation('');
                setTimeEntries([]);
                setStandaloneExpenses([]);
                setRateOverrides({});
                setEnableRateOverrides(false);
                const dates = getLastMonthDates();
                setStartDate(dates.start);
                setEndDate(dates.end);
                setDatePreset('last-month');
                setShowLocationDropdown(false);
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </div>
        
        {locations.length > 0 && !selectedLocation && (
          <div className="mt-3 text-sm text-gray-500">
            {locations.length} location{locations.length === 1 ? '' : 's'} available
          </div>
        )}
      </div>

      {timeEntries.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{selectedLocation}</h2>
              <p className="text-sm text-gray-500">
                {format(parseISO(startDate), 'MMMM d, yyyy')} - {format(parseISO(endDate), 'MMMM d, yyyy')}
              </p>
            </div>
            <button
              onClick={generateExcel}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Generate Invoice
            </button>
          </div>

          {/* Invoice Settings */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
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
              <div className="flex items-end">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableRateOverrides}
                    onChange={(e) => setEnableRateOverrides(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable per-employee rate overrides</span>
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
              {Object.keys(locationSummary.employeeHours).length} employee(s) • {locationSummary.entries.length} time entr{locationSummary.entries.length === 1 ? 'y' : 'ies'} • {locationSummary.standaloneExpenses.length} expense record(s)
            </div>
          </div>

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
                              value={overrideRate ?? baseRate}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                  setRateOverrides(prev => ({
                                    ...prev,
                                    [userId]: val
                                  }));
                                }
                              }}
                              className="w-24 px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-blue-500"
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

      {timeEntries.length === 0 && !isLoading && selectedLocation && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No records found for the selected criteria.</p>
        </div>
      )}
    </div>
  );
}