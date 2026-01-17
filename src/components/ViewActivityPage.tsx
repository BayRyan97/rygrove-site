import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format, parseISO, differenceInMinutes, eachDayOfInterval, subDays, subMonths, startOfQuarter, subQuarters, subYears } from 'date-fns';
import { Calendar, Search, User, MapPin, ChevronDown, ChevronRight, X, Download, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
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

const distinctColors = [
  'hsl(15, 75%, 55%)',   // Orange-red
  'hsl(45, 85%, 50%)',   // Golden yellow
  'hsl(120, 60%, 45%)',  // Green
  'hsl(200, 75%, 50%)',  // Sky blue
  'hsl(280, 60%, 55%)',  // Purple
  'hsl(340, 75%, 55%)',  // Pink
  'hsl(30, 80%, 50%)',   // Orange
  'hsl(180, 60%, 45%)',  // Teal
  'hsl(260, 70%, 60%)',  // Violet
  'hsl(90, 55%, 45%)',   // Lime green
  'hsl(320, 70%, 55%)',  // Magenta
  'hsl(160, 60%, 45%)',  // Sea green
  'hsl(210, 80%, 60%)',  // Light blue
  'hsl(350, 80%, 50%)',  // Red
  'hsl(60, 70%, 50%)',   // Yellow
  'hsl(140, 65%, 45%)',  // Forest green
  'hsl(190, 70%, 50%)',  // Cyan
  'hsl(300, 65%, 55%)',  // Fuchsia
  'hsl(20, 75%, 55%)',   // Coral
  'hsl(240, 60%, 60%)',  // Periwinkle
  'hsl(8, 80%, 58%)',    // Tomato
  'hsl(38, 78%, 52%)',   // Amber
  'hsl(75, 65%, 48%)',   // Chartreuse
  'hsl(105, 70%, 42%)',  // Grass green
  'hsl(135, 55%, 50%)',  // Emerald
  'hsl(165, 65%, 45%)',  // Turquoise
  'hsl(195, 75%, 55%)',  // Azure
  'hsl(220, 70%, 58%)',  // Cornflower
  'hsl(250, 65%, 58%)',  // Slate blue
  'hsl(270, 68%, 60%)',  // Amethyst
  'hsl(290, 72%, 58%)',  // Orchid
  'hsl(310, 75%, 60%)',  // Hot pink
  'hsl(330, 78%, 58%)',  // Rose
  'hsl(355, 85%, 55%)',  // Crimson
  'hsl(25, 82%, 54%)',   // Tangerine
  'hsl(50, 80%, 52%)',   // Gold
  'hsl(68, 75%, 48%)',   // Lime
  'hsl(95, 60%, 45%)',   // Olive green
  'hsl(125, 58%, 48%)',  // Kelly green
  'hsl(150, 62%, 46%)',  // Jade
  'hsl(170, 68%, 48%)',  // Aquamarine
  'hsl(185, 72%, 52%)',  // Caribbean
  'hsl(205, 78%, 58%)',  // Dodger blue
  'hsl(230, 65%, 60%)',  // Royal blue
  'hsl(255, 70%, 62%)',  // Iris
  'hsl(275, 68%, 58%)',  // Lavender
  'hsl(295, 72%, 60%)',  // Violet-pink
  'hsl(315, 76%, 58%)',  // Cerise
  'hsl(335, 80%, 56%)',  // Raspberry
  'hsl(5, 82%, 56%)',    // Scarlet
];

const generateUniqueColor = (index: number): string => {
  if (index < distinctColors.length) {
    return distinctColors[index];
  }
  const goldenRatio = 0.618033988749895;
  const hue = ((index - distinctColors.length) * goldenRatio * 360) % 360;
  const saturation = 65 + ((index - distinctColors.length) % 5) * 5;
  const lightness = 45 + (((index - distinctColors.length) * 11) % 4) * 5;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const createColorMapper = (users: string[]) => {
  const colorMap = new Map<string, string>();
  users.forEach((user, index) => {
    colorMap.set(user, generateUniqueColor(index));
  });
  return colorMap;
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

type DateRangeOption = 'week' | 'month' | 'quarter' | '6months' | 'year' | 'custom';

export function ViewActivityPage() {
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('week');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [personName, setPersonName] = useState('');
  const [location, setLocation] = useState('');
  const [uniqueNames, setUniqueNames] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [isAdmin, setIsAdmin] = useState(false);

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
            const locations = context.dataset.locationData?.[context.dataIndex] || [];
            const locationStr = locations.length > 0 ? ` at ${locations.join(', ')}` : '';
            return `${context.dataset.label}: ${hours.toFixed(1)} hours${locationStr}`;
          }
        }
      }
    }
  };

  const chartData = useMemo(() => {
    if (!entries.length) return null;
    if (!startDate || !endDate) return null;
    if (startDate.length !== 10 || endDate.length !== 10) return null;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return null;
    }

    try {
      const startDateParsed = parseISO(startDate);
      const endDateParsed = parseISO(endDate);

      if (!startDateParsed || !endDateParsed) return null;
      if (isNaN(startDateParsed.getTime()) || isNaN(endDateParsed.getTime())) {
        return null;
      }

      if (startDateParsed > endDateParsed) {
        return null;
      }

      const dateRange = eachDayOfInterval({
        start: startDateParsed,
        end: endDateParsed
      });

      if (!dateRange || dateRange.length === 0) return null;

      const data: { [date: string]: { [user: string]: { hours: number; locations: string[] } } } = {};
      dateRange.forEach(date => {
        try {
          data[format(date, 'yyyy-MM-dd')] = {};
        } catch (e) {
          console.error('Error formatting date:', e);
        }
      });

      entries.forEach(entry => {
        try {
          const entryDate = entry.date;
          const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);

          if (!data[entryDate]) {
            data[entryDate] = {};
          }

          if (!data[entryDate][entry.full_name]) {
            data[entryDate][entry.full_name] = { hours: 0, locations: [] };
          }

          data[entryDate][entry.full_name].hours += hours;
          if (!data[entryDate][entry.full_name].locations.includes(entry.location)) {
            data[entryDate][entry.full_name].locations.push(entry.location);
          }
        } catch (e) {
          console.error('Error processing entry:', e);
        }
      });

      const uniqueUsers = Array.from(new Set(entries.map(entry => entry.full_name))).sort();
      const colorMap = createColorMapper(uniqueUsers);

      return {
        labels: Object.keys(data).sort(),
        datasets: uniqueUsers.map(user => ({
          label: user,
          data: Object.keys(data).sort().map(date => data[date][user]?.hours || 0),
          backgroundColor: colorMap.get(user) || generateUniqueColor(0),
          locationData: Object.keys(data).sort().map(date => data[date][user]?.locations || []),
        }))
      };
    } catch (error) {
      console.error('Error generating chart data:', error);
      return null;
    }
  }, [entries, startDate, endDate]);

  const pieChartData = useMemo(() => {
    if (!entries.length) return null;

    const locationHours: { [location: string]: number } = {};

    entries.forEach(entry => {
      try {
        const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
        if (!locationHours[entry.location]) {
          locationHours[entry.location] = 0;
        }
        locationHours[entry.location] += hours;
      } catch (e) {
        console.error('Error processing entry for pie chart:', e);
      }
    });

    const sortedLocations = Object.entries(locationHours)
      .sort((a, b) => b[1] - a[1])
      .map(([location]) => location);

    const colors = sortedLocations.map((_, index) => generateUniqueColor(index));

    return {
      labels: sortedLocations,
      datasets: [{
        data: sortedLocations.map(location => locationHours[location]),
        backgroundColor: colors,
        borderColor: colors.map(() => '#fff'),
        borderWidth: 2,
      }]
    };
  }, [entries]);

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: true,
        text: 'Hours by Job Location'
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value.toFixed(1)} hrs (${percentage}%)`;
          }
        }
      }
    }
  };

  const summary: ActivitySummary = useMemo(() => {
    try {
      return entries.reduce((acc, entry) => {
        try {
          const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
          const expenses = entry.expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
          acc.uniqueLocations.add(entry.location);

          return {
            totalHours: acc.totalHours + hours,
            totalExpenses: acc.totalExpenses + expenses,
            uniqueLocations: acc.uniqueLocations
          };
        } catch (e) {
          console.error('Error processing entry in summary:', e);
          return acc;
        }
      }, {
        totalHours: 0,
        totalExpenses: 0,
        uniqueLocations: new Set<string>()
      });
    } catch (error) {
      console.error('Error calculating summary:', error);
      return {
        totalHours: 0,
        totalExpenses: 0,
        uniqueLocations: new Set<string>()
      };
    }
  }, [entries]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, {
      locations: Map<string, {
        entries: TimeEntry[];
        totalHours: number;
        totalExpenses: number;
        dateRange: string;
      }>;
      totalHours: number;
      totalExpenses: number;
      dateRange: string;
    }>();

    entries.forEach(entry => {
      if (!groups.has(entry.full_name)) {
        groups.set(entry.full_name, {
          locations: new Map(),
          totalHours: 0,
          totalExpenses: 0,
          dateRange: ''
        });
      }

      const personGroup = groups.get(entry.full_name)!;

      if (!personGroup.locations.has(entry.location)) {
        personGroup.locations.set(entry.location, {
          entries: [],
          totalHours: 0,
          totalExpenses: 0,
          dateRange: ''
        });
      }

      const locationGroup = personGroup.locations.get(entry.location)!;
      locationGroup.entries.push(entry);

      const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
      locationGroup.totalHours += hours;
      personGroup.totalHours += hours;

      const expenses = entry.expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
      locationGroup.totalExpenses += expenses;
      personGroup.totalExpenses += expenses;
    });

    groups.forEach((personGroup, personName) => {
      const allEntries: TimeEntry[] = [];

      personGroup.locations.forEach((locationGroup, location) => {
        locationGroup.entries.sort((a, b) => b.date.localeCompare(a.date));
        allEntries.push(...locationGroup.entries);

        const dates = locationGroup.entries.map(e => e.date).sort();
        if (dates.length > 0) {
          try {
            const firstDate = format(parseISO(dates[0]), 'MMM d');
            const lastDate = format(parseISO(dates[dates.length - 1]), 'MMM d, yyyy');
            locationGroup.dateRange = dates.length === 1 ? lastDate : `${firstDate} - ${lastDate}`;
          } catch (e) {
            locationGroup.dateRange = `${dates[0]} - ${dates[dates.length - 1]}`;
          }
        }
      });

      const personDates = allEntries.map(e => e.date).sort();
      if (personDates.length > 0) {
        try {
          const firstDate = format(parseISO(personDates[0]), 'MMM d');
          const lastDate = format(parseISO(personDates[personDates.length - 1]), 'MMM d, yyyy');
          personGroup.dateRange = personDates.length === 1 ? lastDate : `${firstDate} - ${lastDate}`;
        } catch (e) {
          personGroup.dateRange = `${personDates[0]} - ${personDates[personDates.length - 1]}`;
        }
      }
    });

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  const togglePersonExpanded = (personName: string) => {
    setExpandedPersons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(personName)) {
        newSet.delete(personName);
      } else {
        newSet.add(personName);
      }
      return newSet;
    });
  };

  const toggleLocationExpanded = (personName: string, location: string) => {
    const key = `${personName}:${location}`;
    setExpandedLocations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleDateRangeChange = (option: DateRangeOption) => {
    setDateRangeOption(option);
    const today = new Date();
    let start: Date;

    switch (option) {
      case 'week':
        start = subDays(today, 7);
        break;
      case 'month':
        start = subMonths(today, 1);
        break;
      case 'quarter':
        start = subMonths(today, 3);
        break;
      case '6months':
        start = subMonths(today, 6);
        break;
      case 'year':
        start = subYears(today, 1);
        break;
      case 'custom':
        return;
      default:
        start = subDays(today, 7);
    }

    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(today, 'yyyy-MM-dd'));
  };

  useEffect(() => {
    async function fetchData() {
      try {
        // Check if user is admin
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          setIsAdmin(profile?.role === 'admin');
        }

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

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      alert('Please enter valid dates in format YYYY-MM-DD');
      return;
    }

    try {
      const startDateParsed = parseISO(startDate);
      const endDateParsed = parseISO(endDate);

      if (isNaN(startDateParsed.getTime()) || isNaN(endDateParsed.getTime())) {
        alert('Please enter valid dates');
        return;
      }

      if (startDateParsed > endDateParsed) {
        alert('Start date must be before end date');
        return;
      }
    } catch (error) {
      alert('Please enter valid dates');
      return;
    }

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
  }, []);

  const deleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this time entry?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      setEntries(prevEntries => prevEntries.filter(entry => entry.id !== entryId));
      alert('Time entry deleted successfully');
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete time entry');
    }
  };

  const exportToCSV = () => {
    try {
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
        try {
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
        } catch (e) {
          console.error('Error processing entry for export:', e);
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
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Failed to export data to CSV. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={dateRangeOption}
                onChange={(e) => handleDateRangeChange(e.target.value as DateRangeOption)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="quarter">Last Quarter</option>
                <option value="6months">Last 6 Months</option>
                <option value="year">Last Year</option>
                <option value="custom">Custom Range</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </div>
          {dateRangeOption === 'custom' && (
            <>
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
            </>
          )}
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

          {(chartData || pieChartData) && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setChartType('bar')}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                      chartType === 'bar'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Daily Timeline
                  </button>
                  <button
                    onClick={() => setChartType('pie')}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                      chartType === 'pie'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Job Distribution
                  </button>
                </div>
              </div>

              <div className="h-[400px]">
                {chartType === 'bar' && chartData && (
                  <Bar options={chartOptions} data={chartData} />
                )}
                {chartType === 'pie' && pieChartData && (
                  <Pie options={pieChartOptions} data={pieChartData} />
                )}
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
            {groupedEntries.map(([personName, personGroup]) => {
              const isPersonExpanded = expandedPersons.has(personName);
              const locationEntries = Array.from(personGroup.locations.entries()).sort((a, b) => a[0].localeCompare(b[0]));
              const totalEntries = Array.from(personGroup.locations.values()).reduce((sum, loc) => sum + loc.entries.length, 0);

              return (
                <div key={personName} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => togglePersonExpanded(personName)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isPersonExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900">{personName}</h3>
                        <p className="text-sm text-gray-500">{personGroup.dateRange}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-xs text-gray-500">Hours</p>
                          <p className="text-lg font-semibold text-gray-900">{personGroup.totalHours.toFixed(1)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Expenses</p>
                          <p className="text-lg font-semibold text-gray-900">{formatCurrency(personGroup.totalExpenses)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Jobs</p>
                          <p className="text-lg font-semibold text-gray-900">{personGroup.locations.size}</p>
                        </div>
                      </div>
                    </div>
                  </button>

                  {isPersonExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      <div className="p-4 space-y-3">
                        {locationEntries.map(([location, locationGroup]) => {
                          const locationKey = `${personName}:${location}`;
                          const isLocationExpanded = expandedLocations.has(locationKey);

                          return (
                            <div key={locationKey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <button
                                onClick={() => toggleLocationExpanded(personName, location)}
                                className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {isLocationExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-500" />
                                  )}
                                  <div className="text-left">
                                    <h4 className="text-base font-medium text-gray-900">{location}</h4>
                                    <p className="text-xs text-gray-500">{locationGroup.dateRange}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-4">
                                    <div>
                                      <p className="text-xs text-gray-500">Hours</p>
                                      <p className="text-sm font-semibold text-gray-900">{locationGroup.totalHours.toFixed(1)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Expenses</p>
                                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(locationGroup.totalExpenses)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Entries</p>
                                      <p className="text-sm font-semibold text-gray-900">{locationGroup.entries.length}</p>
                                    </div>
                                  </div>
                                </div>
                              </button>

                              {isLocationExpanded && (
                                <div className="border-t border-gray-200 bg-gray-50">
                                  <div className="p-3 space-y-2">
                                    {locationGroup.entries.map((entry) => {
                                      let formattedDate = entry.date;
                                      try {
                                        formattedDate = format(parseISO(entry.date), 'EEEE, MMMM d, yyyy');
                                      } catch (e) {
                                        console.error('Error formatting date:', e);
                                      }

                                      return (
                                        <div key={entry.id} className="bg-white rounded-lg border border-gray-200 p-3">
                                          <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1">
                                              <p className="text-sm font-medium text-gray-900">
                                                {formattedDate}
                                              </p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                              <div className="text-right">
                                                <p className="text-sm font-medium text-gray-900">
                                                  {entry.start_time} - {entry.end_time}
                                                </p>
                                                {entry.lunch_break && (
                                                  <p className="text-xs text-gray-500">
                                                    Lunch Break: {entry.lunch_break}
                                                  </p>
                                                )}
                                                <p className="text-sm font-semibold text-blue-600 mt-1">
                                                  {calculateDuration(entry.start_time, entry.end_time, entry.lunch_break).toFixed(1)} hrs
                                                </p>
                                              </div>
                                              {isAdmin && (
                                                <button
                                                  onClick={() => deleteEntry(entry.id)}
                                                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                                  title="Delete entry"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          <div className="space-y-2">
                                            {entry.notes && (
                                              <div>
                                                <p className="text-xs font-medium text-gray-700">Notes</p>
                                                <p className="text-sm text-gray-900">{entry.notes}</p>
                                              </div>
                                            )}

                                            {entry.expenses && entry.expenses.length > 0 && (
                                              <div>
                                                <p className="text-xs font-medium text-gray-700 mb-1">Expenses</p>
                                                <div className="space-y-2">
                                                  {entry.expenses.map((expense, index) => (
                                                    <div key={index} className="flex items-start justify-between bg-gray-50 p-2 rounded-lg">
                                                      <div>
                                                        <p className="text-xs text-gray-900">{expense.description}</p>
                                                        {expense.receipt_url && (
                                                          <a
                                                            href={expense.receipt_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-blue-600 hover:text-blue-800"
                                                          >
                                                            View Receipt
                                                          </a>
                                                        )}
                                                      </div>
                                                      <p className="text-xs font-medium text-gray-900">
                                                        ${expense.amount.toFixed(2)}
                                                      </p>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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