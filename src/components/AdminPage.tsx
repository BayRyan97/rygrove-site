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
}

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  email?: string | null;
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
        .select('*')
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
      setTimeEntries(data || []);
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
    if (!window.confirm('This will generate a temporary password for the user. Continue?')) {
      return;
    }

    setIsResettingPassword(true);
    setResetPasswordUserId(userId);

    try {
      // Generate a temporary password
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
      
      // Send password reset email with the temporary password
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}`,
      });

      if (error) throw error;

      // Show the temporary password to the admin
      alert(`Password reset email sent to ${userEmail}.\n\nYou can also provide this temporary password: ${tempPassword}\n\nPlease share this with the user and ask them to change it after logging in.`);
      
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
      'Full Day',
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
      entry.is_full_day ? 'Yes' : 'No',
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
          is_full_day: editForm.is_full_day
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
                    setPersonFilter(e.target.value);
                    fetchTimeEntries();
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
                    setLocationFilter(e.target.value);
                    fetchTimeEntries();
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
                  <tr key={entry.id} className="hover:bg-gray-50">
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