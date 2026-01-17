import React, { useState, useEffect, useRef } from 'react';
import { Plus, RefreshCw, MapPin, ChevronDown, DollarSign, User, Store, Upload, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
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
  const [locations, setLocations] = useState<string[]>([]);
  const [retailers, setRetailers] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const [activeEmployeeDropdownIndex, setActiveEmployeeDropdownIndex] = useState<number | null>(null);
  const [activeRetailerDropdownIndex, setActiveRetailerDropdownIndex] = useState<{ entry: number, expense: number } | null>(null);
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
    user_id: userId,
    full_name: currentUserProfile?.full_name || '',
    expenses: []
  });

  const createDefaultExpense = (): Expense => ({
    amount: 0,
    description: '',
    receipt_url: null,
    receipt_image_url: null,
    retailer_id: null,
    retailer_name: ''
  });

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
          setIsAdmin(profile.role === 'admin');

          if (profile.role === 'admin') {
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
            user_id: isAdmin ? entry.user_id : userId,
            full_name: isAdmin ? entry.full_name : currentUserProfile?.full_name
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
                const filePath = `${isAdmin ? entry.user_id : userId}/${fileName}`;

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
                user_id: isAdmin ? entry.user_id : userId,
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
      alert('Time entries and expenses submitted successfully!');
    } catch (error) {
      console.error('Error submitting entries:', error);
      alert('Failed to submit entries. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmployeeSelect = (employeeId: string, employeeName: string, entryIndex: number) => {
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

  // Filter locations based on search term
  const filteredLocations = locations.filter(location =>
    location.toLowerCase().includes(locationSearchTerm.toLowerCase())
  );

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
                {isAdmin && (
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
                        onClick={() => setActiveEmployeeDropdownIndex(entryIndex)}
                        className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Select employee"
                        required
                      />
                      {activeEmployeeDropdownIndex === entryIndex && (
                        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                          {employees.map((employee) => (
                            <button
                              key={employee.id}
                              type="button"
                              onClick={() => handleEmployeeSelect(employee.id, employee.full_name, entryIndex)}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50"
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
                        setLocationSearchTerm(e.target.value);
                        setEntries(newEntries);
                      }}
                      onClick={() => setActiveDropdownIndex(entryIndex)}
                      className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter or select location"
                      required
                    />
                    <ChevronDown
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                      size={16}
                      onClick={() => setActiveDropdownIndex(entryIndex)}
                    />
                    {activeDropdownIndex === entryIndex && filteredLocations.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                        {filteredLocations.map((location) => (
                          <button
                            key={location}
                            type="button"
                            onClick={() => handleLocationSelect(location, entryIndex)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50"
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

                <div className="lg:col-span-3">
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
                            onClick={() => setActiveRetailerDropdownIndex({ entry: entryIndex, expense: expenseIndex })}
                            className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter or select retailer"
                            required
                          />
                          {activeRetailerDropdownIndex?.entry === entryIndex &&
                           activeRetailerDropdownIndex?.expense === expenseIndex && (
                            <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                              {retailers.map((retailer) => (
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
                                  className="w-full px-4 py-2 text-left hover:bg-gray-50"
                                >
                                  {retailer.name}
                                </button>
                              ))}
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