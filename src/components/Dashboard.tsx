import React, { useState, useEffect, useRef } from 'react';
import { Calendar, DollarSign, LogOut, Eye, Shield, Menu, X, ChevronDown, FileSpreadsheet, Calculator, FolderKanban, Home } from 'lucide-react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { TimeEntriesPage } from './TimeEntriesPage';
import { ViewActivityPage } from './ViewActivityPage';
import { AdminPage } from './AdminPage';
import { CreateInvoicePage } from './CreateInvoicePage';
import { ExpensePage } from './ExpensePage';
import { EstimateWorksheetPage } from './EstimateWorksheetPage';
import PlannerPage from './PlannerPage';
import { ProfilePictureUploader } from './ProfilePictureUploader';
import { ProfileAvatar } from './ProfileAvatar';
import { ProtectedRoute } from './ProtectedRoute';
import { LandingPage } from './LandingPage';

interface DashboardProps {
  user: SupabaseUser;
}

interface Profile {
  full_name: string;
  role?: string;
  profile_picture_url?: string;
  picture_metadata?: {
    zoom: number;
    offsetX: number;
    offsetY: number;
  };
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  show: boolean;
  group: 'core' | 'tools' | 'admin';
}

export function Dashboard({ user }: DashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname.slice(1) || 'view-activity';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pictureTimestamp, setPictureTimestamp] = useState<number>(Date.now());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const menuItems: MenuItem[] = [
    // Core Features
    {
      id: 'view-activity',
      label: 'Activity Dashboard',
      icon: Eye,
      show: true,
      group: 'core'
    },
    {
      id: 'enter-activity',
      label: 'Time Management',
      icon: Calendar,
      show: true,
      group: 'core'
    },
    {
      id: 'estimate-worksheet',
      label: 'Estimate Worksheet',
      icon: Calculator,
      show: true,
      group: 'core'
    },
    // Tools
    {
      id: 'create-invoice',
      label: 'Create Invoice',
      icon: FileSpreadsheet,
      show: true,
      group: 'tools'
    },
    {
      id: 'expenses',
      label: 'Expense Management',
      icon: DollarSign,
      show: true,
      group: 'tools'
    },
    {
      id: 'planner',
      label: 'Project Planner',
      icon: FolderKanban,
      show: true,
      group: 'tools'
    },
    // Admin
    {
      id: 'admin',
      label: 'Admin Dashboard',
      icon: Shield,
      show: isAdmin,
      group: 'admin'
    },
    {
      id: 'landing',
      label: 'Landing Page',
      icon: Home,
      show: true,
      group: 'admin'
    }
  ];

  const getCurrentSection = () => {
    return menuItems.find(item => item.id === activeTab)?.label || 'Dashboard';
  };

  useEffect(() => {
    async function getProfile() {
      // Force fresh data from Supabase (no cache)
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role, profile_picture_url, picture_metadata')
        .eq('id', user.id)
        .single()
        .then(result => ({
          ...result,
          // Add timestamp to bust any frontend cache
          _refreshed: Date.now()
        }));
      
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
    <div
      className={`min-h-screen ${
        activeTab === 'admin'
          ? 'bg-gradient-to-br from-white via-red-50 to-red-300'
          : activeTab === 'create-invoice'
            ? 'bg-gradient-to-br from-white via-green-50 to-emerald-300'
          : 'gradient-bg'
      }`}
    >
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-lg z-50 rounded-b-xl">
        <div className="container mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/view-activity')}
                className="text-2xl font-bold text-blue-600 tracking-tight hover:text-blue-700 transition-colors cursor-pointer"
              >
                RY<span className="text-blue-500">GROVE</span>
              </button>
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
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-2">
                    {(() => {
                      const visibleItems = menuItems.filter(item => item.show);
                      const coreItems = visibleItems.filter(item => item.group === 'core');
                      const toolItems = visibleItems.filter(item => item.group === 'tools');
                      const adminItems = visibleItems.filter(item => item.group === 'admin');

                      const renderGroup = (items: MenuItem[], groupLabel?: string) => {
                        if (items.length === 0) return null;
                        return (
                          <div key={groupLabel || 'default'}>
                            {groupLabel && (
                              <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                {groupLabel}
                              </div>
                            )}
                            {items.map(item => {
                              const Icon = item.icon;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    navigate('/' + item.id);
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
                        );
                      };

                      return (
                        <>
                          {renderGroup(coreItems)}
                          {toolItems.length > 0 && coreItems.length > 0 && (
                            <div className="my-1 border-t border-gray-200" />
                          )}
                          {renderGroup(toolItems, 'Tools')}
                          {adminItems.length > 0 && (toolItems.length > 0 || coreItems.length > 0) && (
                            <div className="my-1 border-t border-gray-200" />
                          )}
                          {renderGroup(adminItems, 'Admin')}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                >
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-800">{profile?.full_name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                  <ProfileAvatar
                    pictureUrl={profile?.profile_picture_url}
                    metadata={profile?.picture_metadata}
                    size="sm"
                    lastUpdated={pictureTimestamp}
                  />
                </button>
                {isUserDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-[500px] bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 max-h-[90vh] overflow-y-auto">
                    <div className="mb-4 pb-4 border-b border-gray-200">
                      <h3 className="font-medium text-gray-900 mb-3">Profile Picture</h3>
                      <ProfilePictureUploader
                        userId={user.id}
                        currentPictureUrl={profile?.profile_picture_url}
                        currentMetadata={profile?.picture_metadata}
                        onSuccess={(url, metadata) => {
                          setProfile(prev => prev ? {
                            ...prev,
                            profile_picture_url: url,
                            picture_metadata: metadata
                          } : null);
                          setPictureTimestamp(Date.now());
                        }}
                      />
                    </div>
                    
                    <button
                      onClick={() => {
                        handleSignOut();
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
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
                      navigate('/' + item.id);
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
          <div
            className={`rounded-2xl shadow-xl p-6 card-hover ${
              activeTab === 'admin'
                ? 'bg-gradient-to-br from-white via-red-50 to-red-300'
                : 'bg-white'
            }`}
          >
            <Routes>
              <Route path="/landing" element={<LandingPage isAuthenticated={true} />} />
              <Route path="/" element={<ViewActivityPage />} />
              <Route path="/view-activity" element={<ViewActivityPage />} />
              <Route path="/enter-activity" element={<TimeEntriesPage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/estimate-worksheet" element={<EstimateWorksheetPage />} />
              <Route path="/create-invoice" element={<CreateInvoicePage />} />
              <Route path="/expenses" element={<ExpensePage />} />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminPage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  );
}