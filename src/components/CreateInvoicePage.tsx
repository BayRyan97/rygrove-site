import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { FileSpreadsheet, Search, MapPin, ChevronDown, Download } from 'lucide-react';
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
}

export function CreateInvoicePage() {
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [standaloneExpenses, setStandaloneExpenses] = useState<StandaloneExpense[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('location')
        .not('location', 'is', null);

      if (error) throw error;
      const uniqueLocations = Array.from(new Set(data.map(entry => entry.location))).sort();
      setLocations(uniqueLocations);
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
          full_name,
          is_full_day,
          expenses (
            amount,
            description,
            receipt_url,
            retailer:retailers(name)
          )
        `)
        .eq('location', selectedLocation)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      // Transform the data to include retailer name
      const transformedData = data?.map(entry => ({
        ...entry,
        expenses: entry.expenses.map(expense => ({
          ...expense,
          retailer_name: expense.retailer?.name
        }))
      })) || [];

      setTimeEntries(transformedData);

      // Fetch standalone expenses from the expenses table
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          id,
          date,
          amount,
          description,
          location,
          receipt_url,
          retailer:retailers(name)
        `)
        .eq('location', selectedLocation)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (expensesError) throw expensesError;

      // Transform standalone expenses data
      const transformedExpenses = expensesData?.map(expense => ({
        ...expense,
        retailer_name: expense.retailer?.name
      })) || [];

      setStandaloneExpenses(transformedExpenses);
    } catch (error) {
      console.error('Error fetching time entries:', error);
      alert('Failed to fetch time entries');
    } finally {
      setIsLoading(false);
    }
  };

  const locationSummary: LocationSummary = useMemo(() => {
    const summary = timeEntries.reduce((acc: LocationSummary, entry) => {
      // Calculate hours
      const startTime = parseISO(`2000-01-01T${entry.is_full_day ? '09:00' : entry.start_time}`);
      const endTime = parseISO(`2000-01-01T${entry.is_full_day ? '17:00' : entry.end_time}`);
      let minutes = (endTime.getTime() - startTime.getTime()) / 1000 / 60;

      if (entry.lunch_break) {
        const [hours, mins] = entry.lunch_break.split(':').map(Number);
        minutes -= (hours * 60 + mins);
      }

      const hours = minutes / 60;

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
      standaloneExpenses: []
    });

    // Add standalone expenses to the total
    summary.totalExpenses += standaloneExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    summary.standaloneExpenses = standaloneExpenses;

    return summary;
  }, [timeEntries, standaloneExpenses]);

  const generateExcel = () => {
    const headers = [
      'Date',
      'Employee',
      'Start Time',
      'End Time',
      'Lunch Break',
      'Hours',
      'Notes',
      'Expense Amount',
      'Expense Description',
      'Retailer',
      'Receipt URL'
    ];

    const rows: string[][] = [];

    // Add summary section
    rows.push(['Location Summary:', selectedLocation]);
    rows.push(['Period:', `${format(parseISO(startDate), 'MM/dd/yyyy')} - ${format(parseISO(endDate), 'MM/dd/yyyy')}`]);
    rows.push(['']);
    rows.push(['Total Hours:', locationSummary.totalHours.toFixed(2)]);
    rows.push(['Total Expenses:', `$${locationSummary.totalExpenses.toFixed(2)}`]);
    rows.push(['']);
    
    // Add employee hours breakdown
    rows.push(['Employee Hours Breakdown:']);
    Object.entries(locationSummary.employeeHours).forEach(([name, hours]) => {
      rows.push([name, hours.toFixed(2)]);
    });
    rows.push(['']);
    rows.push(['Detailed Time Entries:']);
    rows.push(headers);

    // Add detailed entries
    locationSummary.entries.forEach(entry => {
      const baseRow = [
        format(parseISO(entry.date), 'MM/dd/yyyy'),
        entry.full_name,
        entry.is_full_day ? '09:00' : entry.start_time,
        entry.is_full_day ? '17:00' : entry.end_time,
        entry.lunch_break || '',
        locationSummary.employeeHours[entry.full_name].toFixed(2),
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
      rows.push(['Additional Expenses (from Expense Worksheet):']);
      rows.push(['Date', 'Expense Amount', 'Expense Description', 'Retailer', 'Receipt URL']);

      locationSummary.standaloneExpenses.forEach(expense => {
        rows.push([
          format(parseISO(expense.date), 'MM/dd/yyyy'),
          expense.amount.toFixed(2),
          expense.description,
          expense.retailer_name || '',
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                onClick={() => setShowLocationDropdown(true)}
                className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Select location"
              />
              <ChevronDown
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                size={20}
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              />
              {showLocationDropdown && locations.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                  {locations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        setSelectedLocation(loc);
                        setShowLocationDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4">
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
        </div>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Hours</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {locationSummary.totalHours.toFixed(1)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expenses</h3>
              <p className="text-2xl font-semibold text-gray-900">
                ${locationSummary.totalExpenses.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Employees</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {Object.keys(locationSummary.employeeHours).length}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Employee Hours</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(locationSummary.employeeHours).map(([name, hours]) => (
                <div key={name} className="p-4 border rounded-lg">
                  <div className="font-medium text-gray-900">{name}</div>
                  <div className="text-gray-500">{hours.toFixed(1)} hours</div>
                </div>
              ))}
            </div>
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