import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Store, Upload, MapPin, ChevronDown, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const downloadReceipt = async (url: string, filename?: string) => {
  try {
    // Clean the URL by removing newlines and URL-encoded newlines
    const cleanUrl = url.trim().replace(/%0A/g, '').replace(/\n/g, '');
    console.log('Downloading receipt from URL:', cleanUrl);
    
    const response = await fetch(cleanUrl);
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    console.log('Blob size:', blob.size, 'Type:', blob.type);
    
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'receipt.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    console.error('Attempted URL:', url);
    alert(`Failed to download receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

interface Expense {
  id?: string;
  date: string;
  amount: number;
  description: string;
  location: string;
  receipt_url?: string | null;
  receipt_image_url?: string | null;
  retailer_id?: string | null;
  retailer_name?: string;
  user_id?: string;
}

interface Retailer {
  id: string;
  name: string;
}

export function ExpensePage() {
  const [expenses, setExpenses] = useState<Expense[]>([{
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '' as any,
    description: '',
    location: '',
    retailer_name: ''
  }]);
  const [locations, setLocations] = useState<string[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState<number | null>(null);
  const [showRetailerDropdown, setShowRetailerDropdown] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const retailerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLocations();
    fetchRetailers();
    fetchCurrentUser();

    function handleClickOutside(event: MouseEvent) {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setShowLocationDropdown(null);
      }
      if (retailerDropdownRef.current && !retailerDropdownRef.current.contains(event.target as Node)) {
        setShowRetailerDropdown(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (user) {
        setUserId(user.id);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
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
      console.log('[ExpensePage] Final combined locations:', combined);
      setLocations(combined);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchRetailers = async () => {
    try {
      const { data, error } = await supabase
        .from('retailers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setRetailers(data || []);
    } catch (error) {
      console.error('Error fetching retailers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!userId) {
        throw new Error('User not authenticated. Please refresh and try again.');
      }

      for (const [expenseIndex, expense] of expenses.entries()) {
        const normalizedAmount = Number(expense.amount);
        if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
          throw new Error(`Expense ${expenseIndex + 1}: Please enter a valid amount greater than 0.`);
        }

        if (!expense.location || expense.location.trim() === '') {
          throw new Error(`Expense ${expenseIndex + 1}: Location is required.`);
        }

        if (!expense.description || expense.description.trim() === '') {
          throw new Error(`Expense ${expenseIndex + 1}: Description is required.`);
        }

        if (expense.receipt_url && expense.receipt_url.startsWith('blob:')) {
          try {
            const response = await fetch(expense.receipt_url);
            const blob = await response.blob();
            const fileExt = blob.type.split('/')[1] || 'jpg';
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${userId}/${fileName}`;

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
            console.error('Receipt upload error:', {
              step: 'receipt_upload_error',
              expenseIndex,
              uploadError
            });
          }
        }

        let retailerId = expense.retailer_id;
        const retailerName = expense.retailer_name?.trim();
        if (retailerName && !retailerId) {
          const { data: existingRetailers, error: retailerLookupError } = await supabase
            .from('retailers')
            .select('id')
            .eq('name', retailerName)
            .limit(1);

          if (retailerLookupError) {
            console.error('Retailer lookup error:', {
              step: 'retailer_lookup_error',
              expenseIndex,
              retailerName,
              code: retailerLookupError.code,
              message: retailerLookupError.message,
              details: retailerLookupError.details,
              hint: retailerLookupError.hint
            });
            throw retailerLookupError;
          }

          if (existingRetailers && existingRetailers.length > 0) {
            retailerId = existingRetailers[0].id;
          } else {
            const { data: insertedRetailer, error: retailerInsertError } = await supabase
              .from('retailers')
              .insert({ name: retailerName })
              .select('id')
              .single();

            if (retailerInsertError) {
              if (retailerInsertError.code === '23505') {
                const { data: duplicateRetailers, error: duplicateLookupError } = await supabase
                  .from('retailers')
                  .select('id')
                  .eq('name', retailerName)
                  .limit(1);

                if (duplicateLookupError || !duplicateRetailers || duplicateRetailers.length === 0) {
                  throw duplicateLookupError || retailerInsertError;
                }

                retailerId = duplicateRetailers[0].id;
              } else {
                console.error('Retailer insert error:', {
                  step: 'retailer_insert_error',
                  expenseIndex,
                  retailerName,
                  code: retailerInsertError.code,
                  message: retailerInsertError.message,
                  details: retailerInsertError.details,
                  hint: retailerInsertError.hint
                });
                throw retailerInsertError;
              }
            } else {
              retailerId = insertedRetailer.id;
            }
          }
        }

        const { error: expenseError } = await supabase
          .from('expenses')
          .insert({
            user_id: userId,
            date: expense.date,
            amount: Number(normalizedAmount.toFixed(2)),
            description: expense.description,
            location: expense.location,
            retailer_id: retailerId,
            receipt_url: expense.receipt_url,
            receipt_image_url: expense.receipt_image_url
          });

        if (expenseError) {
          console.error('Expense insert error:', {
            step: 'expense_insert_error',
            expenseIndex,
            payload: {
              user_id: userId,
              date: expense.date,
              amount: Number(normalizedAmount.toFixed(2)),
              description: expense.description,
              location: expense.location,
              retailer_id: retailerId,
              hasReceipt: Boolean(expense.receipt_url)
            },
            code: expenseError.code,
            message: expenseError.message,
            details: expenseError.details,
            hint: expenseError.hint
          });
          throw expenseError;
        }
      }

      setExpenses([{
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: '' as any,
        description: '',
        location: '',
        retailer_name: ''
      }]);
      await fetchLocations();
      alert('Expenses submitted successfully!');
    } catch (error) {
      console.error('Error submitting expenses:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else if (error && typeof error === 'object' && 'message' in error) {
        alert(String((error as { message?: string }).message || 'Failed to submit expenses. Please try again.'));
      } else {
        alert('Failed to submit expenses. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (index: number, file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPEG, PNG, HEIC, HEIF images and PDF files are allowed');
      }

      const newExpenses = [...expenses];
      newExpenses[index].receipt_url = URL.createObjectURL(file);
      setExpenses(newExpenses);
    } catch (error) {
      console.error('Error handling file:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Failed to handle file. Please try again.');
      }
    }
  };

  const addExpense = () => {
    setExpenses([...expenses, {
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '' as any,
      description: '',
      location: '',
      retailer_name: ''
    }]);
  };

  const removeExpense = (index: number) => {
    if (expenses.length === 1) {
      setExpenses([{
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: '' as any,
        description: '',
        location: '',
        retailer_name: ''
      }]);
    } else {
      setExpenses(expenses.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800">Expense Management</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {expenses.map((expense, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Expense {index + 1}
              </h3>
              {expenses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExpense(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={expense.date}
                  onChange={(e) => {
                    const newExpenses = [...expenses];
                    newExpenses[index].date = e.target.value;
                    setExpenses(newExpenses);
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expense.amount}
                    onChange={(e) => {
                      const newExpenses = [...expenses];
                      newExpenses[index].amount = e.target.value as any;
                      setExpenses(newExpenses);
                    }}
                    className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0.00"
                    inputMode="decimal"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location (Job)</label>
                <div className="relative" ref={locationDropdownRef}>
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={expense.location}
                    onChange={(e) => {
                      const newExpenses = [...expenses];
                      newExpenses[index].location = e.target.value;
                      setExpenses(newExpenses);
                      setShowLocationDropdown(index);
                    }}
                    onClick={() => setShowLocationDropdown(index)}
                    className="w-full pl-8 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter or select location"
                    required
                  />
                  <ChevronDown
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                    size={16}
                    onClick={() => setShowLocationDropdown(index)}
                  />
                  {showLocationDropdown === index && locations.filter(loc => loc.toLowerCase().includes(expense.location.toLowerCase())).length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                      {locations.filter(loc => loc.toLowerCase().includes(expense.location.toLowerCase())).map((location) => (
                        <button
                          key={location}
                          type="button"
                          onClick={() => {
                            const newExpenses = [...expenses];
                            newExpenses[index].location = location;
                            setExpenses(newExpenses);
                            setShowLocationDropdown(null);
                          }}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Retailer</label>
                <div className="relative" ref={retailerDropdownRef}>
                  <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={expense.retailer_name || ''}
                    onChange={(e) => {
                      const newExpenses = [...expenses];
                      newExpenses[index].retailer_name = e.target.value;
                      setExpenses(newExpenses);
                      setShowRetailerDropdown(index);
                    }}
                    onClick={() => setShowRetailerDropdown(index)}
                    className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter or select retailer"
                    required
                  />
                  {showRetailerDropdown === index && retailers.filter(r => r.name.toLowerCase().includes((expense.retailer_name || '').toLowerCase())).length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                      {retailers.filter(r => r.name.toLowerCase().includes((expense.retailer_name || '').toLowerCase())).map((retailer) => (
                        <button
                          key={retailer.id}
                          type="button"
                          onClick={() => {
                            const newExpenses = [...expenses];
                            newExpenses[index].retailer_id = retailer.id;
                            newExpenses[index].retailer_name = retailer.name;
                            setExpenses(newExpenses);
                            setShowRetailerDropdown(null);
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
                  onChange={(e) => {
                    const newExpenses = [...expenses];
                    newExpenses[index].description = e.target.value;
                    setExpenses(newExpenses);
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter expense description"
                  required
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt</label>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <Upload className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm text-gray-600">Upload Receipt</span>
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(index, file);
                          }
                        }}
                        accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
                        className="hidden"
                      />
                    </label>
                  </div>
                  {expense.receipt_url && (
                    <button
                      type="button"
                      onClick={() => downloadReceipt(expense.receipt_url!, `receipt-${index + 1}.jpg`)}
                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                      Download Receipt
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={addExpense}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                Submitting...
              </span>
            ) : (
              'Submit Expenses'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}