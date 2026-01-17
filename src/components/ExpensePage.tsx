import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Store, Upload, Search, MapPin, ChevronDown, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';

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
    amount: 0,
    description: '',
    location: '',
    retailer_name: ''
  }]);
  const [locations, setLocations] = useState<string[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState<number | null>(null);
  const [showRetailerDropdown, setShowRetailerDropdown] = useState<number | null>(null);
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const retailerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLocations();
    fetchRetailers();

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
      for (const expense of expenses) {
        if (expense.receipt_url && expense.receipt_url.startsWith('blob:')) {
          try {
            const response = await fetch(expense.receipt_url);
            const blob = await response.blob();
            const fileExt = blob.type.split('/')[1];
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${expense.user_id}/${fileName}`;

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
            date: expense.date,
            amount: expense.amount,
            description: expense.description,
            location: expense.location,
            retailer_id: retailerId,
            receipt_url: expense.receipt_url,
            receipt_image_url: expense.receipt_image_url
          });

        if (expenseError) throw expenseError;
      }

      setExpenses([{
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: 0,
        description: '',
        location: '',
        retailer_name: ''
      }]);
      alert('Expenses submitted successfully!');
    } catch (error) {
      console.error('Error submitting expenses:', error);
      alert('Failed to submit expenses. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (index: number, file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPEG, PNG, HEIC, and HEIF images are allowed');
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
      amount: 0,
      description: '',
      location: '',
      retailer_name: ''
    }]);
  };

  const removeExpense = (index: number) => {
    if (expenses.length === 1) {
      setExpenses([{
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: 0,
        description: '',
        location: '',
        retailer_name: ''
      }]);
    } else {
      setExpenses(expenses.filter((_, i) => i !== index));
    }
  };

  const filteredLocations = locations.filter(location =>
    location.toLowerCase().includes(locationSearchTerm.toLowerCase())
  );

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
                      newExpenses[index].amount = parseFloat(e.target.value);
                      setExpenses(newExpenses);
                    }}
                    className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
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
                      setLocationSearchTerm(e.target.value);
                      setExpenses(newExpenses);
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
                  {showLocationDropdown === index && filteredLocations.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                      {filteredLocations.map((location) => (
                        <button
                          key={location}
                          type="button"
                          onClick={() => {
                            const newExpenses = [...expenses];
                            newExpenses[index].location = location;
                            setExpenses(newExpenses);
                            setShowLocationDropdown(null);
                            setLocationSearchTerm('');
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
                    }}
                    onClick={() => setShowRetailerDropdown(index)}
                    className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter or select retailer"
                    required
                  />
                  {showRetailerDropdown === index && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                      {retailers.map((retailer) => (
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