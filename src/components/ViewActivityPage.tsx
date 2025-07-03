import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format, parseISO, differenceInMinutes, eachDayOfInterval, subDays } from 'date-fns';
import { Calendar, Search, User, MapPin, ChevronDown, X, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TimeEntry {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  lunch_break: string | null;
  notes: string | null;
  created_at: string;
  user_id: string;
  full_name: string;
  is_full_day: boolean;
  expenses: {
    amount: number;
    description: string;
    receipt_url: string | null;
  }[];
}

interface ActivitySummary {
  totalHours: number;
  totalExpenses: number;
  uniqueLocations: Set<string>;
}

const CHART_COLORS = [
  '#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD',
  '#8C564B', '#E377C2', '#7F7F7F', '#BCBD22', '#17BECF'
];

const userColorMap = new Map<string, string>();
let colorIndex = 0;

const getColorForUser = (userName: string): string => {
  if (!userColorMap.has(userName)) {
    userColorMap.set(userName, CHART_COLORS[colorIndex % CHART_COLORS.length]);
    colorIndex++;
  }
  return userColorMap.get(userName)!;
};

const calculateDuration = (start: string, end: string, lunchBreak: string | null) => {
  const startTime = parseISO(`2000-01-01T${start}`);
  const endTime = parseISO(`2000-01-01T${end}`);
  let minutes = differenceInMinutes(endTime, startTime);
  
  if (lunchBreak) {
    const [hours, mins] = lunchBreak.split(':').map(Number);
    minutes -= (hours * 60 + mins);
  }
  
  return minutes / 60;
};

// Format number as currency with commas
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export function ViewActivityPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [personName, setPersonName] = useState('');
  const [location, setLocation] = useState('');
  const [uniqueNames, setUniqueNames] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Date'
        }
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: 'Hours'
        },
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Daily Hours by Person'
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const hours = context.parsed.y;
            return `${context.dataset.label}: ${hours.toFixed(1)} hours`;
          }
        }
      }
    }
  };

  const chartData = useMemo(() => {
    if (!entries.length || !startDate || !endDate) return null;

    const dateRange = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate)
    });

    const data: { [date: string]: { [user: string]: number } } = {};
    dateRange.forEach(date => {
      data[format(date, 'yyyy-MM-dd')] = {};
    });

    entries.forEach(entry => {
      const entryDate = entry.date;
      const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);

      if (!data[entryDate]) {
        data[entryDate] = {};
      }
      
      if (!data[entryDate][entry.full_name]) {
        data[entryDate][entry.full_name] = 0;
      }
      
      data[entryDate][entry.full_name] += hours;
    });

    const uniqueUsers = Array.from(new Set(entries.map(entry => entry.full_name)));

    return {
      labels: Object.keys(data).sort(),
      datasets: uniqueUsers.map(user => ({
        label: user,
        data: Object.keys(data).sort().map(date => data[date][user] || 0),
        backgroundColor: getColorForUser(user),
      }))
    };
  }, [entries, startDate, endDate]);

  const summary: ActivitySummary = useMemo(() => {
    return entries.reduce((acc, entry) => {
      const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
      const expenses = entry.expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
      acc.uniqueLocations.add(entry.location);
      
      return {
        totalHours: acc.totalHours + hours,
        totalExpenses: acc.totalExpenses + expenses,
        uniqueLocations: acc.uniqueLocations
      };
    }, {
      totalHours: 0,
      totalExpenses: 0,
      uniqueLocations: new Set<string>()
    });
  }, [entries]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch unique names from time_entries
        const { data: namesData, error: namesError } = await supabase
          .from('time_entries')
          .select('full_name')
          .order('full_name');

        if (namesError) throw namesError;
        const uniqueFullNames = Array.from(new Set(namesData.map(entry => entry.full_name))).sort();
        setUniqueNames(uniqueFullNames);

        const { data: locationData, error: locationError } = await supabase
          .from('time_entries')
          .select('location')
          .not('location', 'is', null);

        if (locationError) throw locationError;
        const uniqueLocations = [...new Set(locationData.map(entry => entry.location))].sort();
        setLocations(uniqueLocations);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    fetchData();
  }, []);

  const fetchEntries = async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('time_entries')
        .select(`
          id,
          date,
          start_time,
          end_time,
          location,
          lunch_break,
          notes,
          created_at,
          user_id,
          full_name,
          is_full_day,
          expenses (amount, description, receipt_url)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (location) {
        query = query.eq('location', location);
      }
      if (personName) {
        query = query.eq('full_name', personName);
      }

      const { data, error } = await query;
      if (error) throw error;

      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
      alert('Failed to fetch entries.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchEntries();
    }
  }, [startDate, endDate]);

  const exportToCSV = () => {
    const headers = [
      'Date',
      'Employee',
      'Location',
      'Start Time',
      'End Time',
      'Lunch Break',
      'Hours',
      'Full Day',
      'Notes',
      'Expense Amount',
      'Expense Description',
      'Receipt URL'
    ];

    const rows: string[][] = [];
    entries.forEach(entry => {
      const baseRow = [
        format(parseISO(entry.date), 'MM/dd/yyyy'),
        entry.full_name,
        entry.location,
        entry.is_full_day ? '09:00' : entry.start_time,
        entry.is_full_day ? '17:00' : entry.end_time,
        entry.lunch_break || '',
        calculateDuration(
          entry.is_full_day ? '09:00' : entry.start_time,
          entry.is_full_day ? '17:00' : entry.end_time,
          entry.lunch_break
        ).toString(),
        entry.is_full_day ? 'Yes' : 'No',
        entry.notes || ''
      ];

      if (entry.expenses && entry.expenses.length > 0) {
        entry.expenses.forEach(expense => {
          rows.push([
            ...baseRow,
            expense.amount.toString(),
            expense.description,
            expense.receipt_url || ''
          ]);
        });
      } else {
        rows.push([...baseRow, '', '', '']);
      }
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `activity-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Person</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="">All Users</option>
                {uniqueNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <div className="relative" ref={locationDropdownRef}>
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onClick={() => setShowLocationDropdown(true)}
                className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter or select location"
              />
              <ChevronDown
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                size={20}
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              />
              {showLocationDropdown && locations.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setLocation('');
                      setShowLocationDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-500 text-sm"
                  >
                    All locations
                  </button>
                  {locations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        setLocation(loc);
                        setShowLocationDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={fetchEntries}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search Activities
              </>
            )}
          </button>
          <button
            onClick={() => {
              setLocation('');
              setPersonName('');
              fetchEntries();
            }}
            disabled={isLoading}
            className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Hours</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {summary.totalHours.toFixed(1)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expenses</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(summary.totalExpenses)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Unique Locations</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {summary.uniqueLocations.size}
              </p>
            </div>
          </div>

          {chartData && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="h-[400px]">
                <Bar options={chartOptions} data={chartData} />
              </div>
            </div>
          )}

          <div className="flex justify-end mb-4">
            <button
              onClick={exportToCSV}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export to CSV
            </button>
          </div>

          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{entry.full_name}</h3>
                    <p className="text-sm text-gray-500">
                      {format(parseISO(entry.date), 'EEEE, MMMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {entry.start_time} - {entry.end_time}
                    </p>
                    {entry.lunch_break && (
                      <p className="text-sm text-gray-500">
                        Lunch Break: {entry.lunch_break}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Location</p>
                    <p className="text-sm text-gray-900">{entry.location}</p>
                  </div>

                  {entry.notes && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Notes</p>
                      <p className="text-sm text-gray-900">{entry.notes}</p>
                    </div>
                  )}

                  {entry.expenses && entry.expenses.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Expenses</p>
                      <div className="space-y-2">
                        {entry.expenses.map((expense, index) => (
                          <div key={index} className="flex items-start justify-between bg-gray-50 p-3 rounded-lg">
                            <div>
                              <p className="text-sm text-gray-900">{expense.description}</p>
                              {expense.receipt_url && (
                                <a
                                  href={expense.receipt_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  View Receipt
                                </a>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900">
                              ${expense.amount.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {entries.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No activities found for the selected criteria.</p>
        </div>
      )}
    </div>
  );
}