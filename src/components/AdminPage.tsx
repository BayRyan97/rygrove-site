import React, { useState, useEffect } from 'react';
import { Shield, Save, Search, ChevronDown, Calendar, Clock, MapPin, DollarSign, User, Filter, Edit2, X, Check, Download, Plus, UserPlus, Key, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, parseISO, differenceInMinutes, subDays } from 'date-fns';

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
  work_type?: string[] | null;
  work_type_other?: string | null;
  rate?: number | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  email?: string | null;
  rate?: number | null;
}

interface CreateUserForm {
  full_name: string;
  email: string;
  password: string;
  role: string;
}

type AdminView = 'users' | 'time-entries' | 'create-user';

const calculateTotalHours = (entry: TimeEntry): number => {
  if (entry.is_full_day) {
    return entry.lunch_break ? 7.5 : 8; // 8 hours for full day, 7.5 if lunch break
  }

  const startTime = parseISO(`2000-01-01T${entry.start_time}`);
  const endTime = parseISO(`2000-01-01T${entry.end_time}`);
  let minutes = differenceInMinutes(endTime, startTime);

  if (entry.lunch_break) {
    const [hours, mins] = entry.lunch_break.split(':').map(Number);
    minutes -= (hours * 60 + mins);
  }

  return Number((minutes / 60).toFixed(2));
};

function AdminPage() {
  const [activeView, setActiveView] = useState<AdminView>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [personFilter, setPersonFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [locations, setLocations] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TimeEntry>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>({
    full_name: '',
    email: '',
    password: '',
    role: 'employee'
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [rateEditValues, setRateEditValues] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchTimeEntries();
      fetchLocations();
    }
  }, [isAdmin, startDate, endDate]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile?.role !== 'admin') {
        throw new Error('Not authorized');
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin status:', error);
      window.location.href = '/'; // Redirect to home if not admin
    } finally {
      setIsLoading(false);
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

  const fetchUsers = async () => {
    try {
      // Fetch profiles with RLS policies handling the access control
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, email')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to fetch users');
    }
  };

  const fetchTimeEntries = async () => {
    try {
      let query = supabase
        .from('time_entries')
        .select(`
          *,
          profiles!inner(rate)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('full_name')
        .order('start_time');

      if (personFilter) {
        query = query.eq('full_name', personFilter);
      }

      if (locationFilter) {
        query = query.eq('location', locationFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Flatten the profiles.rate into the entry
      const entriesWithRate = (data || []).map((entry: any) => ({
        ...entry,
        rate: entry.profiles?.rate || 0
      }));
      
      setTimeEntries(entriesWithRate);
    } catch (error) {
      console.error('Error fetching time entries:', error);
      alert('Failed to fetch time entries');
    }
  };

  const fetchTimeEntriesWithFilters = async (
    person: string,
    location: string,
    start: string,
    end: string
  ) => {
    try {
      let query = supabase
        .from('time_entries')
        .select(`
          *,
          profiles!inner(rate)
        `)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .order('full_name')
        .order('start_time');

      if (person) {
        query = query.eq('full_name', person);
      }

      if (location) {
        query = query.eq('location', location);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Flatten the profiles.rate into the entry
      const entriesWithRate = (data || []).map((entry: any) => ({
        ...entry,
        rate: entry.profiles?.rate || 0
      }));
      
      setTimeEntries(entriesWithRate);
    } catch (error) {
      console.error('Error fetching time entries:', error);
      alert('Failed to fetch time entries');
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);

    try {
      // Create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createUserForm.email,
        password: createUserForm.password,
        options: {
          data: {
            full_name: createUserForm.full_name
          },
          emailRedirectTo: `${window.location.origin}`
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      // The profile will be automatically created by the trigger
      // But we need to update the role if it's not 'employee'
      if (createUserForm.role !== 'employee') {
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role: createUserForm.role })
          .eq('id', authData.user.id);

        if (roleError) throw roleError;
      }

      // Reset form
      setCreateUserForm({
        full_name: '',
        email: '',
        password: '',
        role: 'employee'
      });

      // Refresh users list
      await fetchUsers();
      
      // Switch back to users view
      setActiveView('users');
      
      alert('User account created successfully!');
    } catch (error) {
      console.error('Error creating user:', error);
      alert(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const resetUserPassword = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Reset password for ${userEmail}? A temporary password will be generated.`)) {
      return;
    }

    setIsResettingPassword(true);
    setResetPasswordUserId(userId);

    try {
      // Get the current session to include auth header
      const { data: { session } } = await supabase.auth.getSession();
      
      // Call the Edge Function to reset password server-side
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/reset-user-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`
          },
          body: JSON.stringify({ userId })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      const result = await response.json();
      const tempPassword = result.tempPassword;

      alert(
        `Password reset successfully!\n\n` +
        `Email: ${userEmail}\n` +
        `Temporary Password: ${tempPassword}\n\n` +
        `Please share this password with the user. They should change it after logging in.`
      );
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(`Failed to reset password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResettingPassword(false);
      setResetPasswordUserId(null);
    }
  };

  const exportToCSV = () => {
    // Create CSV header
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
      'User ID',
      'Entry ID'
    ];

    // Convert entries to CSV rows
    const rows = timeEntries.map(entry => [
      format(parseISO(entry.date), 'MM/dd/yyyy'),
      entry.full_name,
      entry.location,
      entry.is_full_day ? '09:00' : entry.start_time,
      entry.is_full_day ? '17:00' : entry.end_time,
      entry.lunch_break || '',
      calculateTotalHours(entry),
      entry.rate || 0,
      entry.is_full_day ? 'Yes' : 'No',
      entry.work_type?.join('; ') || '',
      entry.work_type_other || '',
      entry.notes || '',
      entry.user_id,
      entry.id
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell
      ).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `time-entries-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));

      alert('User role updated successfully');
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role');
    } finally {
      setIsSaving(false);
    }
  };

  const updateUserRate = async (userId: string, newRate: number) => {
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({ rate: newRate })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user => 
        user.id === userId ? { ...user, rate: newRate } : user
      ));
    } catch (error) {
      console.error('Error updating user rate:', error);
      alert('Failed to update user rate');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRateInputChange = (userId: string, value: string) => {
    setRateEditValues(prev => ({
      ...prev,
      [userId]: value
    }));
  };

  const handleRateInputBlur = (userId: string) => {
    const value = rateEditValues[userId];
    if (value !== undefined) {
      const numValue = parseFloat(value) || 0;
      updateUserRate(userId, numValue);
      setRateEditValues(prev => {
        const newValues = { ...prev };
        delete newValues[userId];
        return newValues;
      });
    }
  };

  const startEditing = (entry: TimeEntry) => {
    setEditingEntry(entry.id);
    setEditForm(entry);
  };

  const cancelEditing = () => {
    setEditingEntry(null);
    setEditForm({});
  };

  const saveTimeEntry = async () => {
    if (!editingEntry || !editForm) return;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('time_entries')
        .update({
          date: editForm.date,
          start_time: editForm.start_time,
          end_time: editForm.end_time,
          location: editForm.location,
          lunch_break: editForm.lunch_break,
          notes: editForm.notes,
          is_full_day: editForm.is_full_day,
          work_type: editForm.work_type,
          work_type_other: editForm.work_type_other
        })
        .eq('id', editingEntry);

      if (error) throw error;

      setTimeEntries(timeEntries.map(entry =>
        entry.id === editingEntry ? { ...entry, ...editForm } : entry
      ));
      setEditingEntry(null);
      setEditForm({});

      // Refresh the entries to ensure we have the latest data
      fetchTimeEntries();
    } catch (error) {
      console.error('Error updating time entry:', error);
      alert('Failed to update time entry');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTimeEntry = async (entryId: string, employeeName: string, date: string) => {
    if (!window.confirm(`Are you sure you want to delete this time entry for ${employeeName} on ${format(parseISO(date), 'MM/dd/yyyy')}? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      setTimeEntries(timeEntries.filter(entry => entry.id !== entryId));
      alert('Time entry deleted successfully');
    } catch (error) {
      console.error('Error deleting time entry:', error);
      alert('Failed to delete time entry');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTimeEntries = timeEntries.filter(entry =>
    entry.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clearFilters = () => {
    setPersonFilter('');
    setLocationFilter('');
    setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
    setSearchTerm('');
    fetchTimeEntries();
  };

  const getCurrentSection = () => {
    switch (activeView) {
      case 'users':
        return 'User Management';
      case 'time-entries':
        return 'Time Entries';
      case 'create-user':
        return 'Create New User';
      default:
        return 'Admin Dashboard';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4">
        {/* Title and View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              {activeView === 'users' ? (
                <>
                  <User className="h-6 w-6" />
                  User Management
                </>
              ) : activeView === 'time-entries' ? (
                <>
                  <Calendar className="h-6 w-6" />
                  Time Entries
                </>
              ) : (
                <>
                  <UserPlus className="h-6 w-6" />
                  Create New User
                </>
              )}
            </h2>
          </div>

          {/* Navigation and Actions */}
          <div className="flex items-center gap-3">
            {/* View Navigation */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveView('users')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'users' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setActiveView('time-entries')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'time-entries' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Time Entries
              </button>
              <button
                onClick={() => setActiveView('create-user')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'create-user' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Create User
              </button>
            </div>

            {activeView === 'time-entries' && (
              <>
                <button
                  onClick={exportToCSV}
                  className="flex items-center px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center px-3 py-2 rounded-lg border ${
                    showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {(personFilter || locationFilter || startDate !== format(subDays(new Date(), 7), 'yyyy-MM-dd') || endDate !== format(new Date(), 'yyyy-MM-dd')) && (
                    <span className="ml-2 bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                      Active
                    </span>
                  )}
                </button>
              </>
            )}

            {(activeView === 'users' || activeView === 'time-entries') && (
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder={`Search ${activeView === 'users' ? 'users by name' : 'entries'}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        {activeView === 'time-entries' && showFilters && (
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select
                  value={personFilter}
                  onChange={(e) => {
                    const newFilter = e.target.value;
                    setPersonFilter(newFilter);
                    fetchTimeEntriesWithFilters(newFilter, locationFilter, startDate, endDate);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Employees</option>
                  {users.map(user => (
                    <option key={user.id} value={user.full_name}>{user.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <select
                  value={locationFilter}
                  onChange={(e) => {
                    const newFilter = e.target.value;
                    setLocationFilter(newFilter);
                    fetchTimeEntriesWithFilters(personFilter, newFilter, startDate, endDate);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Locations</option>
                  {locations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {activeView === 'create-user' ? (
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={createUser} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={createUserForm.full_name}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={createUserForm.email}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                  minLength={6}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={createUserForm.role}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setActiveView('users')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {isCreatingUser ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : activeView === 'users' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hourly Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email || 'No email'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.role}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 mr-1">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rateEditValues[user.id] !== undefined ? rateEditValues[user.id] : (user.rate || 0)}
                        onChange={(e) => handleRateInputChange(user.id, e.target.value)}
                        onBlur={() => handleRateInputBlur(user.id)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value)}
                      disabled={isSaving}
                      className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                    {user.email && (
                      <button
                        onClick={() => resetUserPassword(user.id, user.email!)}
                        disabled={isResettingPassword && resetPasswordUserId === user.id}
                        className="inline-flex items-center px-3 py-1 border border-orange-300 rounded-lg text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                      >
                        {isResettingPassword && resetPasswordUserId === user.id ? (
                          <>
                            <div className="animate-spin h-3 w-3 border-2 border-orange-600 border-t-transparent rounded-full mr-1"></div>
                            Resetting...
                          </>
                        ) : (
                          <>
                            <Key className="h-3 w-3 mr-1" />
                            Reset Password
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="max-h-[calc(100vh-16rem)] overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 w-24">
                    Actions
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Start
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    End
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Lunch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTimeEntries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr className="hover:bg-gray-50">
                      {editingEntry === entry.id ? (
                      <>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={saveTimeEntry}
                              disabled={isSaving}
                              className="p-1 text-green-600 hover:text-green-800"
                            >
                              <Check className="h-5 w-5" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-1 text-gray-600 hover:text-gray-800"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="date"
                            value={editForm.date || ''}
                            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{entry.full_name}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={editForm.location || ''}
                            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="time"
                            value={editForm.is_full_day ? '09:00' : (editForm.start_time || '')}
                            onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value, is_full_day: false })}
                            className="w-24 px-2 py-1 text-sm border rounded"
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="time"
                            value={editForm.is_full_day ? '17:00' : (editForm.end_time || '')}
                            onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value, is_full_day: false })}
                            className="w-24 px-2 py-1 text-sm border rounded"
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <select
                            value={editForm.lunch_break || ''}
                            onChange={(e) => setEditForm({ ...editForm, lunch_break: e.target.value })}
                            className="w-24 px-2 py-1 text-sm border rounded"
                          >
                            <option value="">None</option>
                            <option value="00:30">0:30</option>
                            <option value="00:45">0:45</option>
                            <option value="01:00">1:00</option>
                          </select>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {calculateTotalHours(editForm as TimeEntry)}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => startEditing(entry)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="Edit entry"
                            >
                              <Edit2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => deleteTimeEntry(entry.id, entry.full_name, entry.date)}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="Delete entry"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {format(parseISO(entry.date), 'MM/dd/yy')}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{entry.full_name}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{entry.location}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {entry.is_full_day ? '09:00' : entry.start_time}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {entry.is_full_day ? '17:00' : entry.end_time}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {entry.lunch_break || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {calculateTotalHours(entry)}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                  {editingEntry === entry.id && (
                    <tr key={`${entry.id}-edit`} className="bg-blue-50">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="space-y-3">
                          <div>
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
                                    name={`work_type_${entry.id}`}
                                    value={opt.key}
                                    checked={editForm.work_type?.[0] === opt.key}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setEditForm({
                                          ...editForm,
                                          work_type: [opt.key],
                                          work_type_other: opt.key !== 'Other' ? null : editForm.work_type_other
                                        });
                                      }
                                    }}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                  />
                                  <span className="text-sm text-gray-700">{opt.label}</span>
                                </label>
                              ))}
                            </div>

                            {/* Other text input */}
                            {editForm.work_type?.[0] === 'Other' && (
                              <div className="mt-2">
                                <input
                                  type="text"
                                  value={editForm.work_type_other || ''}
                                  onChange={(e) => {
                                    setEditForm({
                                      ...editForm,
                                      work_type_other: e.target.value
                                    });
                                  }}
                                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                  placeholder="Describe other work type"
                                  required={editForm.work_type?.[0] === 'Other'}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {filteredTimeEntries.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No time entries found for the selected criteria.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { AdminPage };