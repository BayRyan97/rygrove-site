import React, { useState, useEffect, useRef } from 'react';
import { Calendar, DollarSign, LogOut, Eye, Shield, Menu, X, ChevronDown, FileSpreadsheet, User, Calculator } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { TimeEntriesPage } from './TimeEntriesPage';
import { ViewActivityPage } from './ViewActivityPage';
import { AdminPage } from './AdminPage';
import { CreateInvoicePage } from './CreateInvoicePage';
import { ExpensePage } from './ExpensePage';
import { EstimateWorksheetPage } from './EstimateWorksheetPage';

interface DashboardProps {
  user: SupabaseUser;
}

interface Profile {
  full_name: string;
  role?: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  show: boolean;
}

export function Dashboard({ user }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('view-activity');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const menuItems: MenuItem[] = [
    {
      id: 'enter-activity',
      label: 'Time Management',
      icon: Calendar,
      show: true
    },
    {
      id: 'view-activity',
      label: 'Activity Dashboard',
      icon: Eye,
      show: true
    },
    {
      id: 'estimate-worksheet',
      label: 'Estimate Worksheet',
      icon: Calculator,
      show: true
    },
    {
      id: 'create-invoice',
      label: 'Create Invoice',
      icon: FileSpreadsheet,
      show: true
    },
    {
      id: 'admin',
      label: 'Admin Dashboard',
      icon: Shield,
      show: isAdmin
    },
    {
      id: 'expenses',
      label: 'Expense Management',
      icon: DollarSign,
      show: true
    }
  ];

  const getCurrentSection = () => {
    return menuItems.find(item => item.id === activeTab)?.label || 'Dashboard';
  };

  useEffect(() => {
    async function getProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();
      
      if (!error && data) {
        setProfile(data);
        setIsAdmin(data.role === 'admin');
      }
    }
    getProfile();
  }, [user.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-lg z-50 rounded-b-xl">
        <div className="container mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600 tracking-tight">
                RY<span className="text-blue-500">GROVE</span>
              </span>
              <div className="h-6 w-[2px] bg-blue-200 mx-3 hidden sm:block" />
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 focus:outline-none hidden sm:flex"
                >
                  <span>{getCurrentSection()}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1">
                    {menuItems.filter(item => item.show).map(item => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center space-x-2 px-4 py-2 text-sm whitespace-nowrap ${
                            activeTab === item.id 
                              ? 'bg-blue-50 text-blue-600' 
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center space-x-2 text-right hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-800">{profile?.full_name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                  <User className="h-5 w-5 text-gray-400" />
                </button>
                {isUserDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1">
                    <button
                      onClick={() => {
                        handleSignOut();
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg sm:hidden"
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6 text-gray-600" />
                ) : (
                  <Menu className="h-6 w-6 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsMenuOpen(false)}>
          <div
            className="fixed top-16 right-0 bottom-0 w-64 bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <nav className="p-4 space-y-2">
              {menuItems.filter(item => item.show).map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      activeTab === item.id 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => {
                  handleSignOut();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-4"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 card-hover">
            {activeTab === 'enter-activity' ? (
              <TimeEntriesPage />
            ) : activeTab === 'view-activity' ? (
              <ViewActivityPage />
            ) : activeTab === 'estimate-worksheet' ? (
              <EstimateWorksheetPage />
            ) : activeTab === 'create-invoice' ? (
              <CreateInvoicePage />
            ) : activeTab === 'admin' ? (
              <AdminPage />
            ) : activeTab === 'expenses' ? (
              <ExpensePage />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}