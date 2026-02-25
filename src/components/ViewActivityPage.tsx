import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format, parseISO, differenceInMinutes, eachDayOfInterval, subDays, subMonths, startOfQuarter, subQuarters, subYears } from 'date-fns';
import { Calendar, Search, User, MapPin, ChevronDown, ChevronRight, X, Download, Trash2 } from 'lucide-react';
import { supabase, getUserRole } from '../lib/supabase';
import { generateActivityPDF } from '../lib/pdfExport';
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
  work_type?: string[] | null;
  work_type_other?: string | null;
  rate?: number | null;
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

const formatHours = (hours: number): string => {
  return Number.isInteger(hours) ? hours.toString() : hours.toFixed(1);
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
  const [selectedPersons, setSelectedPersons] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [uniqueNames, setUniqueNames] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showLocationHighlight, setShowLocationHighlight] = useState(0);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [showDateRangeDropdown, setShowDateRangeDropdown] = useState(false);
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const personDropdownRef = useRef<HTMLDivElement>(null);
  const dateRangeDropdownRef = useRef<HTMLDivElement>(null);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<TimeEntry> | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<TimeEntry[]>([]);
  const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);
  const chartRef = useRef<ChartJS | null>(null);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Date'
        },
        ticks: {
          callback: function(value: any, index: number, ticks: any[]) {
            const labels = this.getLabelForValue ? this.getLabelForValue(value) : chartData?.labels?.[index];
            if (labels && typeof labels === 'string') {
              try {
                const formattedDate = format(parseISO(labels), 'MM/dd/yyyy');
                const dayOfWeek = format(parseISO(labels), 'EEE');
                return [formattedDate, dayOfWeek];
              } catch (e) {
                return labels;
              }
            }
            return labels;
          },
          maxRotation: 0,
          autoSkip: true
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
        display: true,
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
            const hasWarning = context.dataset.overHoursMultiJob?.[context.dataIndex];
            const warningText = hasWarning ? ' ⚠️ Over 8 hrs across multiple jobs' : '';
            return `${context.dataset.label}: ${hours.toFixed(1)} hours${locationStr}${warningText}`;
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

      const data: { [date: string]: { [user: string]: { hours: number; locations: string[]; entryIds: string[] } } } = {};
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
            data[entryDate][entry.full_name] = { hours: 0, locations: [], entryIds: [] };
          }

          data[entryDate][entry.full_name].hours += hours;
          data[entryDate][entry.full_name].entryIds.push(entry.id);
          if (!data[entryDate][entry.full_name].locations.includes(entry.location)) {
            data[entryDate][entry.full_name].locations.push(entry.location);
          }
        } catch (e) {
          console.error('Error processing entry:', e);
        }
      });

      const uniqueUsers = Array.from(new Set(entries.map(entry => entry.full_name))).sort();
      const sortedDates = Object.keys(data).sort();

      // Map one color per user so the same person keeps the same color across the chart
      const colorMap = createColorMapper(uniqueUsers);

      return {
        labels: sortedDates,
        datasets: uniqueUsers.map((user) => {
          const dataPoints = sortedDates.map(date => data[date][user]?.hours || 0);
          const locationData = sortedDates.map(date => data[date][user]?.locations || []);
          const overHoursMultiJob = sortedDates.map(date => {
            const hours = data[date][user]?.hours || 0;
            const locations = data[date][user]?.locations || [];
            return hours > 8 && locations.length > 1;
          });

          return {
            label: user,
            data: dataPoints,
            backgroundColor: colorMap.get(user) || generateUniqueColor(0),
            borderColor: overHoursMultiJob.map(flag => (flag ? '#dc2626' : 'transparent')),
            borderWidth: overHoursMultiJob.map(flag => (flag ? 5 : 0)),
            borderSkipped: false,
            locationData,
            entryIdsByDate: sortedDates.map(date => data[date][user]?.entryIds || []),
            overHoursMultiJob,
          };
        })
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

  const totalLaborCost = useMemo(() => {
    return entries.reduce((total, entry) => {
      const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
      const rate = entry.rate || 0;
      return total + (hours * rate);
    }, 0);
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
      totalLaborCost: number;
      dateRange: string;
    }>();

    entries.forEach(entry => {
      if (!groups.has(entry.full_name)) {
        groups.set(entry.full_name, {
          locations: new Map(),
          totalHours: 0,
          totalExpenses: 0,
          totalLaborCost: 0,
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

      const rate = entry.rate || 0;
      personGroup.totalLaborCost += hours * rate;
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
    function handleClickOutside(event: MouseEvent) {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setShowLocationDropdown(false);
      }
      if (personDropdownRef.current && !personDropdownRef.current.contains(event.target as Node)) {
        setShowPersonDropdown(false);
      }
      if (dateRangeDropdownRef.current && !dateRangeDropdownRef.current.contains(event.target as Node)) {
        setShowDateRangeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        // Check if user is admin or supervisor
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          setIsAdmin(profile?.role === 'admin');
          setIsSupervisor(profile?.role === 'supervisor');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    fetchData();
  }, []);

  // Fetch unique names and locations based on current date range
  useEffect(() => {
    async function fetchNamesAndLocationsInDateRange() {
      if (!startDate || !endDate) return;

      try {
        const { data: namesData, error: namesError } = await supabase
          .from('time_entries')
          .select('full_name')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('full_name');

        if (namesError) throw namesError;
        const uniqueFullNames = Array.from(new Set(namesData.map(entry => entry.full_name))).sort();
        setUniqueNames(uniqueFullNames);

        const { data: locationData, error: locationError } = await supabase
          .from('time_entries')
          .select('location')
          .gte('date', startDate)
          .lte('date', endDate)
          .not('location', 'is', null);

        if (locationError) throw locationError;
        const uniqueLocations = [...new Set(locationData.map(entry => entry.location))].sort();
        setLocations(uniqueLocations);
      } catch (error) {
        console.error('Error fetching names and locations:', error);
      }
    }

    fetchNamesAndLocationsInDateRange();
  }, [startDate, endDate]);

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
      // Fetch current user role to ensure we have the latest value
      const { data: { user } } = await supabase.auth.getUser();
      let userRole = 'employee';
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        userRole = profile?.role || 'employee';
      }

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
          work_type,
          work_type_other,
          expenses (amount, description, receipt_url)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (location) {
        query = query.eq('location', location);
      }
      if (selectedPersons.length > 0) {
        query = query.in('full_name', selectedPersons);
      }

      // Filter by user_id for regular employees (not admins or supervisors)
      if (userRole !== 'admin' && userRole !== 'supervisor' && user) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch rates for all unique user_ids if admin/supervisor
      const rateMap = new Map<string, number>();
      if (data && (userRole === 'admin' || userRole === 'supervisor')) {
        const uniqueUserIds = [...new Set(data.map((entry: any) => entry.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, rate')
          .in('id', uniqueUserIds);
        
        profilesData?.forEach(profile => {
          rateMap.set(profile.id, profile.rate || 0);
        });
      } else if (data && user) {
        // For regular employees, just get their own rate
        const { data: profileData } = await supabase
          .from('profiles')
          .select('rate')
          .eq('id', user.id)
          .single();
        
        if (profileData) {
          rateMap.set(user.id, profileData.rate || 0);
        }
      }

      // Add rates to entries
      const entriesWithRate = (data || []).map((entry: any) => ({
        ...entry,
        rate: rateMap.get(entry.user_id) || 0
      }));

      setEntries(entriesWithRate);
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

  const startEditing = (entry: TimeEntry) => {
    setEditingEntryId(entry.id);
    setEditValues({
      date: entry.date,
      start_time: entry.start_time,
      end_time: entry.end_time,
      location: entry.location,
      lunch_break: entry.lunch_break,
      notes: entry.notes,
      work_type: entry.work_type,
      work_type_other: entry.work_type_other
    });
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    setEditValues(null);
  };

  const saveEdit = async (entryId: string) => {
    if (!editValues) return;
    setIsSavingEdit(true);
    try {
      const payload: any = {};
      if (editValues.date) payload.date = editValues.date;
      if (editValues.start_time) payload.start_time = editValues.start_time;
      if (editValues.end_time) payload.end_time = editValues.end_time;
      payload.location = editValues.location ?? '';
      payload.lunch_break = editValues.lunch_break ?? null;
      payload.notes = editValues.notes ?? null;
      payload.work_type = editValues.work_type ?? null;
      payload.work_type_other = editValues.work_type_other ?? null;

      const { data, error } = await supabase
        .from('time_entries')
        .update(payload)
        .eq('id', entryId)
        .select(
          `id, date, start_time, end_time, location, lunch_break, notes, created_at, user_id, full_name, is_full_day, work_type, work_type_other, expenses (amount, description, receipt_url)`
        )
        .single();

      if (error) throw error;

      setEntries(prev => prev.map(e => e.id === entryId ? (data as TimeEntry) : e));
      setEditingEntryId(null);
      setEditValues(null);
      alert('Time entry updated');
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const selectedEntry = useMemo(() => {
    if (!selectedEntryId) return null;
    return entries.find(entry => entry.id === selectedEntryId) || null;
  }, [entries, selectedEntryId]);

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedEntryId(null);
    setSelectedEntries([]);
    setEditingEntryId(null);
    setEditValues(null);
  };

  const handleChartClick = (elements: any[]) => {
    if (!elements || elements.length === 0 || !chartData) return;
    const { datasetIndex, index } = elements[0];
    const dataset = chartData.datasets[datasetIndex] as any;
    const entryIds: string[] = dataset?.entryIdsByDate?.[index] || [];
    if (!entryIds.length) return;

    const matches = entries.filter(entry => entryIds.includes(entry.id));
    if (matches.length === 1) {
      setSelectedEntryId(matches[0].id);
      setSelectedEntries(matches);
      setIsEditModalOpen(true);
      return;
    }

    setSelectedEntryId(null);
    setSelectedEntries(matches);
    setIsEditModalOpen(true);
  };

  const openEditModalForEntries = (matches: TimeEntry[]) => {
    if (!matches.length) return;
    if (matches.length === 1) {
      setSelectedEntryId(matches[0].id);
      setSelectedEntries(matches);
      setIsEditModalOpen(true);
      return;
    }

    setSelectedEntryId(null);
    setSelectedEntries(matches);
    setIsEditModalOpen(true);
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
        'Hourly Rate',
        'Full Day',
        'Work Type',
        'Work Type Other',
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
            formatHours(calculateDuration(
              entry.is_full_day ? '09:00' : entry.start_time,
              entry.is_full_day ? '17:00' : entry.end_time,
              entry.lunch_break
            )),
            (entry.rate || 0).toString(),
            entry.is_full_day ? 'Yes' : 'No',
            entry.work_type?.join('; ') || '',
            entry.work_type_other || '',
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

  const exportToPDF = () => {
    try {
      generateActivityPDF(entries, summary, startDate, endDate, selectedPersons.join(', ') || 'All Users', location, isSupervisor);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export data to PDF. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="relative" ref={dateRangeDropdownRef}>
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" size={20} />
              <button
                type="button"
                onClick={() => setShowDateRangeDropdown(!showDateRangeDropdown)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowDateRangeDropdown(!showDateRangeDropdown);
                  }
                }}
                className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-left bg-white text-gray-900"
              >
                {dateRangeOption === 'week' && 'Last Week'}
                {dateRangeOption === 'month' && 'Last Month'}
                {dateRangeOption === 'quarter' && 'Last Quarter'}
                {dateRangeOption === '6months' && 'Last 6 Months'}
                {dateRangeOption === 'year' && 'Last Year'}
                {dateRangeOption === 'custom' && 'Custom Range'}
              </button>
              <ChevronDown
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer pointer-events-none"
                size={20}
              />
              {showDateRangeDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      handleDateRangeChange('week');
                      setShowDateRangeDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-200 ${
                      dateRangeOption === 'week' ? 'font-medium text-blue-600 bg-blue-50' : 'text-gray-700'
                    }`}
                  >
                    Last Week
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDateRangeChange('month');
                      setShowDateRangeDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-200 ${
                      dateRangeOption === 'month' ? 'font-medium text-blue-600 bg-blue-50' : 'text-gray-700'
                    }`}
                  >
                    Last Month
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDateRangeChange('quarter');
                      setShowDateRangeDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-200 ${
                      dateRangeOption === 'quarter' ? 'font-medium text-blue-600 bg-blue-50' : 'text-gray-700'
                    }`}
                  >
                    Last Quarter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDateRangeChange('6months');
                      setShowDateRangeDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-200 ${
                      dateRangeOption === '6months' ? 'font-medium text-blue-600 bg-blue-50' : 'text-gray-700'
                    }`}
                  >
                    Last 6 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDateRangeChange('year');
                      setShowDateRangeDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-200 ${
                      dateRangeOption === 'year' ? 'font-medium text-blue-600 bg-blue-50' : 'text-gray-700'
                    }`}
                  >
                    Last Year
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDateRangeChange('custom');
                      setShowDateRangeDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                      dateRangeOption === 'custom' ? 'font-medium text-blue-600 bg-blue-50' : 'text-gray-700'
                    }`}
                  >
                    Custom Range
                  </button>
                </div>
              )}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        fetchEntries();
                      }
                    }}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        fetchEntries();
                      }
                    }}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Person {selectedPersons.length > 0 && (
                <span className="text-xs text-blue-600">({selectedPersons.length} selected)</span>
              )}
            </label>
            <div className="relative" ref={personDropdownRef}>
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" size={20} />
              <button
                type="button"
                onClick={() => setShowPersonDropdown(!showPersonDropdown)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowPersonDropdown(!showPersonDropdown);
                  }
                }}
                className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-left bg-white"
              >
                {selectedPersons.length === 0 ? (
                  <span className="text-gray-500">All Users</span>
                ) : selectedPersons.length === 1 ? (
                  <span className="text-gray-900">{selectedPersons[0]}</span>
                ) : (
                  <span className="text-gray-900">{selectedPersons.length} users selected</span>
                )}
              </button>
              <ChevronDown
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer pointer-events-none"
                size={20}
              />
              {showPersonDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPersons([]);
                      setShowPersonDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-500 text-sm border-b border-gray-200"
                  >
                    Clear selection (All Users)
                  </button>
                  <div className="py-1">
                    {uniqueNames.map(name => {
                      const isSelected = selectedPersons.includes(name);
                      return (
                        <label
                          key={name}
                          className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPersons(prev => [...prev, name]);
                              } else {
                                setSelectedPersons(prev => prev.filter(p => p !== name));
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                          />
                          <span className={isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}>
                            {name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <div className="relative" ref={locationDropdownRef}>
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setShowLocationDropdown(true);
                  setShowLocationHighlight(0);
                }}
                onClick={() => {
                  setShowLocationDropdown(true);
                  setShowLocationHighlight(0);
                }}
                onKeyDown={(e) => {
                  const filtered = locations.filter(loc => loc.toLowerCase().includes((location || '').toLowerCase()));
                  const max = filtered.length - 1;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setShowLocationHighlight(prev => Math.min(prev + 1, Math.max(0, max)));
                    setShowLocationDropdown(true);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setShowLocationHighlight(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    if (showLocationDropdown && filtered.length > 0) {
                      e.preventDefault();
                      const chosen = filtered[Math.max(0, Math.min(showLocationHighlight, max))];
                      if (chosen) {
                        setLocation(chosen);
                        setShowLocationDropdown(false);
                      }
                    }
                  } else if (e.key === 'Escape') {
                    setShowLocationDropdown(false);
                  }
                }}
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
                  {locations
                    .filter(loc => loc.toLowerCase().includes((location || '').toLowerCase()))
                    .map((loc, i) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          setLocation(loc);
                          setShowLocationDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-50 text-sm ${showLocationHighlight === i ? 'bg-gray-100' : ''}`}
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
              setSelectedPersons([]);
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
          <div className={`grid grid-cols-1 md:grid-cols-2 ${
            isSupervisor 
              ? (summary.totalExpenses > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2')
              : (summary.totalExpenses > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')
          } gap-4 ${isSupervisor ? 'justify-items-center' : ''}`}>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex flex-col items-center justify-center text-center w-full">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Hours</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {formatHours(summary.totalHours)}
              </p>
            </div>
            {!isSupervisor && (
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex flex-col items-center justify-center text-center w-full">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Labor Cost</h3>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(totalLaborCost)}
                </p>
              </div>
            )}
            {summary.totalExpenses > 0 && (
              <button
                onClick={() => setIsExpensesModalOpen(true)}
                className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex flex-col items-center justify-center text-center w-full hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expenses</h3>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(summary.totalExpenses)}
                </p>
                <p className="text-xs text-blue-600 mt-1">Click to view receipts</p>
              </button>
            )}
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex flex-col items-center justify-center text-center w-full">
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
                  <Bar
                    ref={chartRef}
                    options={chartOptions}
                    data={chartData}
                    onClick={(event, elements) => {
                      const native = event.nativeEvent as MouseEvent;
                      if (native.metaKey) {
                        handleChartClick(elements);
                      }
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      const native = event.nativeEvent;
                      const elements = chartRef.current?.getElementsAtEventForMode(
                        native,
                        'nearest',
                        { intersect: true },
                        true
                      );
                      if (elements && elements.length > 0) {
                        handleChartClick(elements);
                      }
                    }}
                  />
                )}
                {chartType === 'pie' && pieChartData && (
                  <Pie options={pieChartOptions} data={pieChartData} />
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end mb-4">
            <div className="flex gap-2">
              <button
                onClick={exportToPDF}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export to PDF
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </button>
            </div>
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
                          <p className="text-lg font-semibold text-gray-900">{formatHours(personGroup.totalHours)}</p>
                        </div>
                        {!isSupervisor && (
                          <div>
                            <p className="text-xs text-gray-500">Labor Cost</p>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(personGroup.totalLaborCost)}</p>
                          </div>
                        )}
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
                                      <p className="text-sm font-semibold text-gray-900">{formatHours(locationGroup.totalHours)}</p>
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
                                          {editingEntryId === entry.id && editValues ? (
                                            <div className="space-y-3">
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div>
                                                  <label className="text-xs text-gray-600">Date</label>
                                                  <input
                                                    type="date"
                                                    value={editValues.date || ''}
                                                    onChange={(e) => setEditValues(prev => ({ ...(prev || {}), date: e.target.value }))}
                                                    className="w-full mt-1 p-2 border rounded"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-xs text-gray-600">Start</label>
                                                  <input
                                                    type="time"
                                                    value={editValues.start_time || ''}
                                                    onChange={(e) => setEditValues(prev => ({ ...(prev || {}), start_time: e.target.value }))}
                                                    className="w-full mt-1 p-2 border rounded"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-xs text-gray-600">End</label>
                                                  <input
                                                    type="time"
                                                    value={editValues.end_time || ''}
                                                    onChange={(e) => setEditValues(prev => ({ ...(prev || {}), end_time: e.target.value }))}
                                                    className="w-full mt-1 p-2 border rounded"
                                                  />
                                                </div>
                                              </div>

                                              <div>
                                                <label className="text-xs text-gray-600">Location</label>
                                                <input
                                                  type="text"
                                                  value={editValues.location || ''}
                                                  onChange={(e) => setEditValues(prev => ({ ...(prev || {}), location: e.target.value }))}
                                                  className="w-full mt-1 p-2 border rounded"
                                                />
                                              </div>

                                              <div>
                                                <label className="text-xs text-gray-600">Lunch Break (HH:MM)</label>
                                                <input
                                                  type="text"
                                                  value={editValues.lunch_break || ''}
                                                  onChange={(e) => setEditValues(prev => ({ ...(prev || {}), lunch_break: e.target.value }))}
                                                  className="w-full mt-1 p-2 border rounded"
                                                  placeholder="00:30"
                                                />
                                              </div>

                                              <div>
                                                <label className="text-xs text-gray-600 block mb-2">Work Type (required)</label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                                  {[
                                                    { key: 'Contract', label: 'Contract' },
                                                    { key: 'Time and material', label: 'Time and material' },
                                                    { key: 'Additional to the contract', label: 'Additional to the contract' },
                                                    { key: 'Other', label: 'Other' }
                                                  ].map((opt) => (
                                                    <label key={opt.key} className="flex items-center space-x-2">
                                                      <input
                                                        type="radio"
                                                        name={`work_type_${entry.id}`}
                                                        value={opt.key}
                                                        checked={editValues.work_type?.[0] === opt.key}
                                                        onChange={(e) => {
                                                          if (e.target.checked) {
                                                            setEditValues(prev => ({
                                                              ...(prev || {}),
                                                              work_type: [opt.key],
                                                              work_type_other: opt.key !== 'Other' ? null : prev?.work_type_other
                                                            }));
                                                          }
                                                        }}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                      />
                                                      <span className="text-sm text-gray-700">{opt.label}</span>
                                                    </label>
                                                  ))}
                                                </div>

                                                {/* Other text input */}
                                                {editValues.work_type?.[0] === 'Other' && (
                                                  <div className="mt-2">
                                                    <input
                                                      type="text"
                                                      value={editValues.work_type_other || ''}
                                                      onChange={(e) =>
                                                        setEditValues(prev => ({
                                                          ...(prev || {}),
                                                          work_type_other: e.target.value
                                                        }))
                                                      }
                                                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                      placeholder="Describe other work type"
                                                      required={editValues.work_type?.[0] === 'Other'}
                                                    />
                                                  </div>
                                                )}
                                              </div>

                                              <div>
                                                <label className="text-xs text-gray-600">Notes</label>
                                                <textarea
                                                  value={editValues.notes || ''}
                                                  onChange={(e) => setEditValues(prev => ({ ...(prev || {}), notes: e.target.value }))}
                                                  className="w-full mt-1 p-2 border rounded"
                                                  rows={3}
                                                />
                                              </div>

                                              <div className="flex gap-2 justify-end">
                                                <button
                                                  onClick={cancelEdit}
                                                  className="px-3 py-2 bg-gray-100 rounded text-sm"
                                                  type="button"
                                                >
                                                  Cancel
                                                </button>
                                                <button
                                                  onClick={() => saveEdit(entry.id)}
                                                  disabled={isSavingEdit}
                                                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
                                                  type="button"
                                                >
                                                  {isSavingEdit ? 'Saving...' : 'Save'}
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <>
                                              <div className="flex justify-between items-start mb-3">
                                                <div className="flex-1">
                                                  <p className="text-base font-medium text-gray-900">
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
                                                      {formatHours(calculateDuration(entry.start_time, entry.end_time, entry.lunch_break))} hrs
                                                    </p>
                                                  </div>
                                                  {isAdmin && (
                                                    <div className="flex items-center gap-2">
                                                      <button
                                                        onClick={() => startEditing(entry)}
                                                        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                                                        title="Edit entry"
                                                      >
                                                        Edit
                                                      </button>
                                                      <button
                                                        onClick={() => deleteEntry(entry.id)}
                                                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                                        title="Delete entry"
                                                      >
                                                        <Trash2 className="h-4 w-4" />
                                                      </button>
                                                    </div>
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
                                            </>
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

      {isEditModalOpen && (selectedEntry || selectedEntries.length > 0) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                {selectedEntry ? (
                  <>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {selectedEntry.full_name} — {format(parseISO(selectedEntry.date), 'MMMM d, yyyy')}
                    </h3>
                    <p className="text-sm text-gray-500">{selectedEntry.location}</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-gray-800">Select an entry</h3>
                    <p className="text-sm text-gray-500">Multiple entries match this bar segment</p>
                  </>
                )}
              </div>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {selectedEntry && editingEntryId === selectedEntry.id && editValues ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Date</label>
                      <input
                        type="date"
                        value={editValues.date || ''}
                        onChange={(e) => setEditValues(prev => ({ ...(prev || {}), date: e.target.value }))}
                        className="w-full mt-1 p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Start</label>
                      <input
                        type="time"
                        value={editValues.start_time || ''}
                        onChange={(e) => setEditValues(prev => ({ ...(prev || {}), start_time: e.target.value }))}
                        className="w-full mt-1 p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">End</label>
                      <input
                        type="time"
                        value={editValues.end_time || ''}
                        onChange={(e) => setEditValues(prev => ({ ...(prev || {}), end_time: e.target.value }))}
                        className="w-full mt-1 p-2 border rounded"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Location</label>
                    <input
                      type="text"
                      value={editValues.location || ''}
                      onChange={(e) => setEditValues(prev => ({ ...(prev || {}), location: e.target.value }))}
                      className="w-full mt-1 p-2 border rounded"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Lunch Break (HH:MM)</label>
                    <input
                      type="text"
                      value={editValues.lunch_break || ''}
                      onChange={(e) => setEditValues(prev => ({ ...(prev || {}), lunch_break: e.target.value }))}
                      className="w-full mt-1 p-2 border rounded"
                      placeholder="00:30"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 block mb-2">Work Type (required)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { key: 'Contract', label: 'Contract' },
                        { key: 'Time and material', label: 'Time and material' },
                        { key: 'Additional to the contract', label: 'Additional to the contract' },
                        { key: 'Other', label: 'Other' }
                      ].map((opt) => (
                        <label key={opt.key} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name={`work_type_${selectedEntry.id}`}
                            value={opt.key}
                            checked={editValues.work_type?.[0] === opt.key}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditValues(prev => ({
                                  ...(prev || {}),
                                  work_type: [opt.key],
                                  work_type_other: opt.key !== 'Other' ? null : prev?.work_type_other
                                }));
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>

                    {editValues.work_type?.[0] === 'Other' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={editValues.work_type_other || ''}
                          onChange={(e) =>
                            setEditValues(prev => ({
                              ...(prev || {}),
                              work_type_other: e.target.value
                            }))
                          }
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Describe other work type"
                          required={editValues.work_type?.[0] === 'Other'}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Notes</label>
                    <textarea
                      value={editValues.notes || ''}
                      onChange={(e) => setEditValues(prev => ({ ...(prev || {}), notes: e.target.value }))}
                      className="w-full mt-1 p-2 border rounded"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-2 bg-gray-100 rounded text-sm"
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveEdit(selectedEntry.id)}
                      disabled={isSavingEdit}
                      className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
                      type="button"
                    >
                      {isSavingEdit ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : selectedEntry ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        {selectedEntry.start_time} - {selectedEntry.end_time}
                      </p>
                      {selectedEntry.lunch_break && (
                        <p className="text-xs text-gray-500">
                          Lunch Break: {selectedEntry.lunch_break}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => startEditing(selectedEntry)}
                        className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
                        type="button"
                      >
                        Edit Entry
                      </button>
                    )}
                  </div>

                  {selectedEntry.notes && (
                    <div>
                      <p className="text-xs font-medium text-gray-700">Notes</p>
                      <p className="text-sm text-gray-900">{selectedEntry.notes}</p>
                    </div>
                  )}

                  {selectedEntry.expenses && selectedEntry.expenses.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Expenses</p>
                      <div className="space-y-2">
                        {selectedEntry.expenses.map((expense, index) => (
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
              ) : (
                <div className="space-y-3">
                  {selectedEntries.map(entry => (
                    <div key={entry.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {entry.full_name} — {format(parseISO(entry.date), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {entry.start_time} - {entry.end_time} • {entry.location}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setSelectedEntryId(entry.id);
                            setSelectedEntries([entry]);
                            startEditing(entry);
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
                          type="button"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isExpensesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">All Expense Receipts</h3>
                <p className="text-sm text-gray-500">
                  {entries.reduce((count, entry) => count + (entry.expenses?.length || 0), 0)} total expenses
                </p>
              </div>
              <button
                onClick={() => setIsExpensesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {entries.map(entry => {
                  if (!entry.expenses || entry.expenses.length === 0) return null;
                  
                  return (
                    <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="mb-3 pb-3 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-900">
                          {entry.full_name} — {format(parseISO(entry.date), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-gray-500">{entry.location}</p>
                      </div>
                      
                      <div className="space-y-2">
                        {entry.expenses.map((expense, index) => (
                          <div key={index} className="flex items-start justify-between bg-gray-50 p-3 rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                              {expense.receipt_url ? (
                                <a
                                  href={expense.receipt_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 mt-1"
                                >
                                  View Receipt →
                                </a>
                              ) : (
                                <p className="text-xs text-gray-400 mt-1">No receipt attached</p>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-gray-900 ml-4">
                              {formatCurrency(expense.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {entries.every(entry => !entry.expenses || entry.expenses.length === 0) && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No expenses found in the selected time period.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}