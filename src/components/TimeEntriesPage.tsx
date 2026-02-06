import React, { useState, useEffect, useRef } from 'react';
import { Plus, RefreshCw, MapPin, ChevronDown, DollarSign, User, Store, Upload, Trash2, X } from 'lucide-react';
import { supabase, getUserRole } from '../lib/supabase';
import { format, parseISO, differenceInMinutes } from 'date-fns';

interface Profile {
  id: string;
  full_name: string;
}

interface Expense {
  id?: string;
  amount: number;
  description: string;
  receipt_url?: string | null;
  receipt_image_url?: string | null;
  retailer_id?: string | null;
  retailer_name?: string;
}

interface TimeEntry {
  id: string;
  date: string;
  is_full_day: boolean;
  start_time: string;
  end_time: string;
  location: string;
  has_lunch_break: boolean;
  lunch_break: string | null;
  notes: string | null;
  user_id: string;
  full_name: string;
  expenses: Expense[];
  work_type?: string[];
  work_type_other?: string | null;
}

const LUNCH_BREAK_OPTIONS = [
  { label: '30 minutes', value: '00:30' },
  { label: '45 minutes', value: '00:45' },
  { label: '1 hour', value: '01:00' },
];

export function TimeEntriesPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [retailers, setRetailers] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const [activeEmployeeDropdownIndex, setActiveEmployeeDropdownIndex] = useState<number | null>(null);
  const [activeRetailerDropdownIndex, setActiveRetailerDropdownIndex] = useState<{ entry: number, expense: number } | null>(null);
  const [employeeHighlight, setEmployeeHighlight] = useState<Record<number, number>>({});
  const [locationHighlight, setLocationHighlight] = useState<Record<number, number>>({});
  const [retailerHighlight, setRetailerHighlight] = useState<Record<string, number>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const retailerDropdownRef = useRef<HTMLDivElement>(null);

  // Add click-away event listeners
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Handle employee dropdown
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setActiveEmployeeDropdownIndex(null);
      }
      
      // Handle location dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownIndex(null);
      }
      
      // Handle retailer dropdown
      if (retailerDropdownRef.current && !retailerDropdownRef.current.contains(event.target as Node)) {
        setActiveRetailerDropdownIndex(null);
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const createDefaultEntry = (): TimeEntry => ({
    id: crypto.randomUUID(),
    date: new Date().toISOString().split('T')[0],
    is_full_day: true,
    start_time: '08:00',
    end_time: '16:30',
    location: '',
    has_lunch_break: true,
    lunch_break: '00:30',
    notes: '',
    user_id: (isAdmin || isSupervisor) ? '' : userId,
    full_name: (isAdmin || isSupervisor) ? '' : (currentUserProfile?.full_name || ''),
    expenses: [],
    work_type: [],
    work_type_other: null
  });

  const createDefaultExpense = (): Expense => ({
    amount: 0,
    description: '',
    receipt_url: null,
    receipt_image_url: null,
    retailer_id: null,
    retailer_name: ''
  });

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
      console.log('Estimate job names:', estimateNames);

      const combined = Array.from(new Set([...locationsFromEntries, ...estimateNames])).sort();
      console.log('Final combined locations:', combined);
      setLocations(combined);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setCurrentUserProfile(profile);
          const userIsAdmin = profile.role === 'admin';
          const userIsSupervisor = profile.role === 'supervisor';
          setIsAdmin(userIsAdmin);
          setIsSupervisor(userIsSupervisor);

          if (userIsAdmin || userIsSupervisor) {
            const { data: employeesData } = await supabase
              .from('profiles')
              .select('id, full_name')
              .order('full_name');
            
            if (employeesData) {
              setEmployees(employeesData);
            }
          }

          setEntries([createDefaultEntry()]);
        }
      }
    };

    const fetchRetailers = async () => {
      const { data } = await supabase
        .from('retailers')
        .select('id, name')
        .order('name');
      
      if (data) {
        setRetailers(data);
      }
    };

    fetchUserData();
    fetchLocations();
    fetchRetailers();
  }, []);

  const calculateEntryHours = (entry: TimeEntry): number => {
    if (entry.is_full_day) {
      return entry.has_lunch_break && entry.lunch_break ? 7.5 : 8;
    }

    const startTime = parseISO(`2000-01-01T${entry.start_time}`);
    const endTime = parseISO(`2000-01-01T${entry.end_time}`);
    let minutes = differenceInMinutes(endTime, startTime);

    if (entry.has_lunch_break && entry.lunch_break) {
      const [hours, mins] = entry.lunch_break.split(':').map(Number);
      minutes -= (hours * 60 + mins);
    }

    return Number((minutes / 60).toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate work_type selection: at least one must be selected per entry
    for (const entry of entries) {
      if (!entry.work_type || entry.work_type.length === 0) {
        alert('Please select at least one Work Type for every time entry.');
        return;
      }
      if (entry.work_type.includes('Other')) {
        // Default to 'Other' if the free text box is empty
        entry.work_type_other = entry.work_type_other?.trim() || 'Other';
      }
    }

    const entriesOver8Hours = entries.filter(entry => calculateEntryHours(entry) > 8);

    if (entriesOver8Hours.length > 0) {
      const entryList = entriesOver8Hours.map(entry => {
        const hours = calculateEntryHours(entry);
        const name = isAdmin ? entry.full_name : 'this employee';
        return `${name} on ${format(parseISO(entry.date), 'MM/dd/yyyy')}: ${hours} hours`;
      }).join('\n');

      const confirmMessage = `The following entries are for more than 8 hours:\n\n${entryList}\n\nAre you sure you want to submit these entries?`;

      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      for (const entry of entries) {
        // Prepare work_type payload. If 'Other' selected, concat reason into the stored value.
        const workTypeForDb = (entry.work_type || []).map(wt => {
          if (wt === 'Other') {
            return entry.work_type_other && entry.work_type_other.trim() !== ''
              ? `Other: ${entry.work_type_other.trim()}`
              : 'Other';
          }
          return wt;
        });

        const { data: timeEntry, error: timeEntryError } = await supabase
          .from('time_entries')
          .insert({
            date: entry.date,
            is_full_day: entry.is_full_day,
            start_time: entry.is_full_day ? '08:00' : entry.start_time,
            end_time: entry.is_full_day ? '16:30' : entry.end_time,
            location: entry.location,
            lunch_break: entry.has_lunch_break ? entry.lunch_break : null,
            notes: entry.notes,
            user_id: (isAdmin || isSupervisor) ? entry.user_id : userId,
            full_name: (isAdmin || isSupervisor) ? entry.full_name : currentUserProfile?.full_name,
            work_type: workTypeForDb,
            work_type_other: entry.work_type_other || null
          })
          .select()
          .single();

        if (timeEntryError) {
          console.error('Time entry error:', timeEntryError);
          throw new Error('Failed to save time entry');
        }

        if (entry.expenses.length > 0) {
          for (const expense of entry.expenses) {
            if (expense.receipt_url && expense.receipt_url.startsWith('blob:')) {
              try {
                const response = await fetch(expense.receipt_url);
                const blob = await response.blob();
                const fileExt = blob.type.split('/')[1];
                const fileName = `${crypto.randomUUID()}.${fileExt}`;
                const filePath = `${(isAdmin || isSupervisor) ? entry.user_id : userId}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                  .from('receipts')
                  .upload(filePath, blob);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                  .from('receipts')
                  .getPublicUrl(filePath);

                expense.receipt_url = publicUrl;
                expense.receipt_image_url = publicUrl;
              } catch (uploadError) {
                console.error('Receipt upload error:', uploadError);
              }
            }

            let retailerId = expense.retailer_id;
            if (expense.retailer_name && !retailerId) {
              // Modified retailer lookup to handle no results properly
              const { data: existingRetailers } = await supabase
                .from('retailers')
                .select('id')
                .eq('name', expense.retailer_name)
                .limit(1);

              if (existingRetailers && existingRetailers.length > 0) {
                retailerId = existingRetailers[0].id;
              } else {
                const { data: newRetailer, error: retailerError } = await supabase
                  .from('retailers')
                  .insert({ name: expense.retailer_name })
                  .select()
                  .single();

                if (retailerError) throw retailerError;
                retailerId = newRetailer.id;
              }
            }

            const { error: expenseError } = await supabase
              .from('expenses')
              .insert({
                time_entry_id: timeEntry.id,
                user_id: (isAdmin || isSupervisor) ? entry.user_id : userId,
                amount: expense.amount,
                description: expense.description,
                retailer_id: retailerId,
                receipt_url: expense.receipt_url,
                receipt_image_url: expense.receipt_image_url
              });

            if (expenseError) throw expenseError;
          }
        }
      }

      setEntries([createDefaultEntry()]);
      await fetchLocations();
      alert('Time entries and expenses submitted successfully!');
    } catch (error) {
      console.error('Error submitting entries:', error);
      alert('Failed to submit entries. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmployeeSelect = (employeeId: string, employeeName: string, entryIndex: number) => {
    if (!isSupervisor) return; // Only allow Supervisors to select employees

    const newEntries = [...entries];
    newEntries[entryIndex].user_id = employeeId;
    newEntries[entryIndex].full_name = employeeName;
    setEntries(newEntries);
    setActiveEmployeeDropdownIndex(null);
  };

  const handleLocationSelect = (location: string, entryIndex: number) => {
    const newEntries = [...entries];
    newEntries[entryIndex].location = location;
    setEntries(newEntries);
    setActiveDropdownIndex(null);
    setLocationSearchTerm('');
  };

  const addSameDayEntry = () => {
    setEntries([...entries, createDefaultEntry()]);
  };

  const clearForm = () => {
    if (window.confirm('Are you sure you want to clear all entries from the form? This will not affect any saved data.')) {
      setIsClearing(true);
      try {
        setEntries([createDefaultEntry()]);
      } finally {
        setIsClearing(false);
      }
    }
  };

  const removeEntry = (entryIndex: number) => {
    if (entries.length === 1) {
      // If it's the last entry, just clear it instead of removing
      setEntries([createDefaultEntry()]);
    } else {
      const newEntries = entries.filter((_, index) => index !== entryIndex);
      setEntries(newEntries);
    }
  };

  const addExpense = (entryIndex: number) => {
    const newEntries = [...entries];
    newEntries[entryIndex].expenses.push(createDefaultExpense());
    setEntries(newEntries);
  };

  const removeExpense = (entryIndex: number, expenseIndex: number) => {
    const newEntries = [...entries];
    newEntries[entryIndex].expenses.splice(expenseIndex, 1);
    setEntries(newEntries);
  };

  const updateExpense = (entryIndex: number, expenseIndex: number, updates: Partial<Expense>) => {
    const newEntries = [...entries];
    newEntries[entryIndex].expenses[expenseIndex] = {
      ...newEntries[entryIndex].expenses[expenseIndex],
      ...updates
    };
    setEntries(newEntries);
  };

  const handleFileUpload = async (entryIndex: number, expenseIndex: number, file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPEG, PNG, HEIC, and HEIF images are allowed');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      updateExpense(entryIndex, expenseIndex, {
        receipt_url: publicUrl,
        receipt_image_url: publicUrl
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Failed to upload receipt. Please try again.');
      }
    }
  };

  // Note: per-entry filtering is applied when rendering dropdowns using the entry's current input value.

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6 mb-8">
          {entries.map((entry, entryIndex) => (
            <div key={entry.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Time Entry {entryIndex + 1}
                </h3>
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(entryIndex)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {(isAdmin || isSupervisor) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                    <div className="relative" ref={employeeDropdownRef}>
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={entry.full_name}
                        onChange={(e) => {
                          const newEntries = [...entries];
                          newEntries[entryIndex].full_name = e.target.value;
                          setEntries(newEntries);
                        }}
                        onClick={() => {
                          setActiveEmployeeDropdownIndex(entryIndex);
                          setEmployeeHighlight(prev => ({ ...prev, [entryIndex]: 0 }));
                        }}
                        onKeyDown={(e) => {
                          const filtered = employees.filter(emp => emp.full_name.toLowerCase().startsWith((entry.full_name || '').toLowerCase()));
                          const max = filtered.length - 1;
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setActiveEmployeeDropdownIndex(entryIndex);
                            setEmployeeHighlight(prev => ({ ...prev, [entryIndex]: Math.min((prev[entryIndex] ?? 0) + 1, Math.max(0, max)) }));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setEmployeeHighlight(prev => ({ ...prev, [entryIndex]: Math.max((prev[entryIndex] ?? 0) - 1, 0) }));
                          } else if (e.key === 'Enter') {
                            if (activeEmployeeDropdownIndex === entryIndex && filtered.length > 0) {
                              e.preventDefault();
                              const idx = employeeHighlight[entryIndex] ?? 0;
                              const chosen = filtered[Math.max(0, Math.min(idx, max))];
                              if (chosen) handleEmployeeSelect(chosen.id, chosen.full_name, entryIndex);
                            }
                          } else if (e.key === 'Escape') {
                            setActiveEmployeeDropdownIndex(null);
                          }
                        }}
                        className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Select employee"
                        required
                      />
                      {activeEmployeeDropdownIndex === entryIndex && (
                          <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                            {employees
                              .filter(emp => emp.full_name.toLowerCase().startsWith((entry.full_name || '').toLowerCase()))
                              .map((employee, i) => (
                                <button
                                  key={employee.id}
                                  type="button"
                                  onClick={() => handleEmployeeSelect(employee.id, employee.full_name, entryIndex)}
                                  className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${((employeeHighlight[entryIndex] ?? 0) === i) ? 'bg-gray-100' : ''}`}
                                >
                                  {employee.full_name}
                                </button>
                              ))}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={entry.date}
                    onChange={(e) => {
                      const newEntries = [...entries];
                      newEntries[entryIndex].date = e.target.value;
                      setEntries(newEntries);
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <div className="relative" ref={dropdownRef}>
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={entry.location}
                      onChange={(e) => {
                        const newEntries = [...entries];
                        newEntries[entryIndex].location = e.target.value;
                        setActiveDropdownIndex(entryIndex);
                        setLocationHighlight(prev => ({ ...prev, [entryIndex]: 0 }));
                        setEntries(newEntries);
                      }}
                      onClick={() => {
                        setActiveDropdownIndex(entryIndex);
                        setLocationHighlight(prev => ({ ...prev, [entryIndex]: 0 }));
                      }}
                      onKeyDown={(e) => {
                        const filtered = locations.filter(loc => loc.toLowerCase().includes((entry.location || '').toLowerCase()));
                        const max = filtered.length - 1;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setActiveDropdownIndex(entryIndex);
                          setLocationHighlight(prev => ({ ...prev, [entryIndex]: Math.min((prev[entryIndex] ?? 0) + 1, Math.max(0, max)) }));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setLocationHighlight(prev => ({ ...prev, [entryIndex]: Math.max((prev[entryIndex] ?? 0) - 1, 0) }));
                        } else if (e.key === 'Enter') {
                          if (activeDropdownIndex === entryIndex && filtered.length > 0) {
                            e.preventDefault();
                            const idx = locationHighlight[entryIndex] ?? 0;
                            const chosen = filtered[Math.max(0, Math.min(idx, max))];
                            if (chosen) handleLocationSelect(chosen, entryIndex);
                          }
                        } else if (e.key === 'Escape') {
                          setActiveDropdownIndex(null);
                        }
                      }}
                      className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter or select location"
                      required
                    />
                    <ChevronDown
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                      size={16}
                      onClick={() => setActiveDropdownIndex(entryIndex)}
                    />
                    {activeDropdownIndex === entryIndex && locations.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                        {locations
                          .filter(loc => loc.toLowerCase().includes((entry.location || '').toLowerCase()))
                          .map((location, i) => (
                            <button
                              key={location}
                              type="button"
                              onClick={() => handleLocationSelect(location, entryIndex)}
                              className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${((locationHighlight[entryIndex] ?? 0) === i) ? 'bg-gray-100' : ''}`}
                            >
                              {location}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={entry.is_full_day ? 'full' : 'partial'}
                    onChange={(e) => {
                      const newEntries = [...entries];
                      newEntries[entryIndex].is_full_day = e.target.value === 'full';
                      setEntries(newEntries);
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="full">Full Day</option>
                    <option value="partial">Partial Day</option>
                  </select>
                </div>

                {!entry.is_full_day && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={entry.start_time}
                        onChange={(e) => {
                          const newEntries = [...entries];
                          newEntries[entryIndex].start_time = e.target.value;
                          setEntries(newEntries);
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={entry.end_time}
                        onChange={(e) => {
                          const newEntries = [...entries];
                          newEntries[entryIndex].end_time = e.target.value;
                          setEntries(newEntries);
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id={`lunch_break_${entry.id}`}
                      checked={entry.has_lunch_break}
                      onChange={(e) => {
                        const newEntries = [...entries];
                        newEntries[entryIndex].has_lunch_break = e.target.checked;
                        if (!e.target.checked) {
                          newEntries[entryIndex].lunch_break = null;
                        } else {
                          newEntries[entryIndex].lunch_break = '00:30';
                        }
                        setEntries(newEntries);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor={`lunch_break_${entry.id}`}
                      className="ml-2 block text-sm font-medium text-gray-700"
                    >
                      Lunch Break
                    </label>
                  </div>
                  {entry.has_lunch_break && (
                    <select
                      value={entry.lunch_break || '00:30'}
                      onChange={(e) => {
                        const newEntries = [...entries];
                        newEntries[entryIndex].lunch_break = e.target.value;
                        setEntries(newEntries);
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {LUNCH_BREAK_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Work Type (required) - placed above Notes */}
                <div className="lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Work Type (required)</label>
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
                          name={`work_type_${entryIndex}`}
                          value={opt.key}
                          checked={entry.work_type?.[0] === opt.key}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newEntries = [...entries];
                              newEntries[entryIndex].work_type = [opt.key];
                              if (opt.key !== 'Other') {
                                newEntries[entryIndex].work_type_other = null;
                              }
                              setEntries(newEntries);
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Other text input */}
                  {entry.work_type?.[0] === 'Other' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={entry.work_type_other || ''}
                        onChange={(e) => {
                          const newEntries = [...entries];
                          newEntries[entryIndex].work_type_other = e.target.value;
                          setEntries(newEntries);
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe other work type"
                        required={entry.work_type?.[0] === 'Other'}
                      />
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={entry.notes || ''}
                      onChange={(e) => {
                        const newEntries = [...entries];
                        newEntries[entryIndex].notes = e.target.value;
                        setEntries(newEntries);
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Add any notes or comments..."
                    />
                  </div>
                </div>
              </div>

              {/* Expenses Section */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Expenses</h4>
                  <button
                    type="button"
                    onClick={() => addExpense(entryIndex)}
                    className="flex items-center text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Expense
                  </button>
                </div>

                <div className="space-y-4">
                  {entry.expenses.map((expense, expenseIndex) => (
                    <div
                      key={expenseIndex}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg relative"
                    >
                      <button
                        type="button"
                        onClick={() => removeExpense(entryIndex, expenseIndex)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={expense.amount}
                            onChange={(e) => updateExpense(entryIndex, expenseIndex, { amount: parseFloat(e.target.value) })}
                            className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Retailer</label>
                        <div className="relative" ref={retailerDropdownRef}>
                          <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            value={expense.retailer_name || ''}
                            onChange={(e) => updateExpense(entryIndex, expenseIndex, { retailer_name: e.target.value })}
                            onClick={() => {
                              setActiveRetailerDropdownIndex({ entry: entryIndex, expense: expenseIndex });
                              const key = `${entryIndex}-${expenseIndex}`;
                              setRetailerHighlight(prev => ({ ...prev, [key]: 0 }));
                            }}
                            onKeyDown={(e) => {
                              const key = `${entryIndex}-${expenseIndex}`;
                              const filtered = retailers.filter(r => r.name.toLowerCase().startsWith((expense.retailer_name || '').toLowerCase()));
                              const max = filtered.length - 1;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setActiveRetailerDropdownIndex({ entry: entryIndex, expense: expenseIndex });
                                setRetailerHighlight(prev => ({ ...prev, [key]: Math.min((prev[key] ?? 0) + 1, Math.max(0, max)) }));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setRetailerHighlight(prev => ({ ...prev, [key]: Math.max((prev[key] ?? 0) - 1, 0) }));
                              } else if (e.key === 'Enter') {
                                if (activeRetailerDropdownIndex?.entry === entryIndex && activeRetailerDropdownIndex?.expense === expenseIndex && filtered.length > 0) {
                                  e.preventDefault();
                                  const idx = retailerHighlight[key] ?? 0;
                                  const chosen = filtered[Math.max(0, Math.min(idx, max))];
                                  if (chosen) {
                                    updateExpense(entryIndex, expenseIndex, { retailer_id: chosen.id, retailer_name: chosen.name });
                                    setActiveRetailerDropdownIndex(null);
                                  }
                                }
                              } else if (e.key === 'Escape') {
                                setActiveRetailerDropdownIndex(null);
                              }
                            }}
                            className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter or select retailer"
                            required
                          />
                          {activeRetailerDropdownIndex?.entry === entryIndex &&
                           activeRetailerDropdownIndex?.expense === expenseIndex && (
                            <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                              {retailers
                                .filter(r => r.name.toLowerCase().startsWith((expense.retailer_name || '').toLowerCase()))
                                .map((retailer, i) => {
                                  const key = `${entryIndex}-${expenseIndex}`;
                                  return (
                                    <button
                                      key={retailer.id}
                                      type="button"
                                      onClick={() => {
                                        updateExpense(entryIndex, expenseIndex, {
                                          retailer_id: retailer.id,
                                          retailer_name: retailer.name
                                        });
                                        setActiveRetailerDropdownIndex(null);
                                      }}
                                      className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${((retailerHighlight[key] ?? 0) === i) ? 'bg-gray-100' : ''}`}
                                    >
                                      {retailer.name}
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={expense.description}
                          onChange={(e) => updateExpense(entryIndex, expenseIndex, { description: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter expense description"
                          required
                        />
                      </div>

                      <div className="lg:col-span-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Receipt</label>
                        <div className="flex items-center space-x-4">
                          <div className="flex-1">
                            <label
                              className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                            >
                              <Upload className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-sm text-gray-600">Upload Receipt</span>
                              <input
                                type="file"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleFileUpload(entryIndex, expenseIndex, file);
                                  }
                                }}
                                accept="image/jpeg,image/png,image/heic,image/heif"
                                className="hidden"
                              />
                            </label>
                          </div>
                          {expense.receipt_url && (
                            <a
                              href={expense.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              View Receipt
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={addSameDayEntry}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </button>
          <button
            type="button"
            onClick={clearForm}
            disabled={isClearing}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-red-600 hover:text-red-800"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Form
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          > {isSubmitting ? (
              <span className="flex items-center">
                <RefreshCw className="animate-spin -ml-1 mr-2 h-5 w-5" />
                Submitting...
              </span>
            ) : (
              'Submit Entries'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}