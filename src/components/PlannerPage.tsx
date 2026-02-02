import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, addDays, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isBefore } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Plus, ChevronLeft, ChevronRight, Calendar, FolderKanban, AlertCircle, ChevronDown, ChevronRight as ChevronRightIcon, Trash2, X } from 'lucide-react';

interface PlannerProject {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  start_date?: string | null;
  end_date?: string | null;
}

interface PlannerCategory {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  color_index: number;
  custom_color?: string | null;
}

interface PlannerTask {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  completed_date: string | null;
}

// Category color palette
const CATEGORY_COLORS = [
  { bg: 'from-purple-400 to-purple-600', light: 'from-purple-50 to-purple-100', hover: 'hover:from-purple-500 hover:to-purple-700', border: 'border-purple-400' },
  { bg: 'from-blue-400 to-blue-600', light: 'from-blue-50 to-blue-100', hover: 'hover:from-blue-500 hover:to-blue-700', border: 'border-blue-400' },
  { bg: 'from-emerald-400 to-emerald-600', light: 'from-emerald-50 to-emerald-100', hover: 'hover:from-emerald-500 hover:to-emerald-700', border: 'border-emerald-400' },
  { bg: 'from-amber-400 to-amber-600', light: 'from-amber-50 to-amber-100', hover: 'hover:from-amber-500 hover:to-amber-700', border: 'border-amber-400' },
  { bg: 'from-rose-400 to-rose-600', light: 'from-rose-50 to-rose-100', hover: 'hover:from-rose-500 hover:to-rose-700', border: 'border-rose-400' },
  { bg: 'from-indigo-400 to-indigo-600', light: 'from-indigo-50 to-indigo-100', hover: 'hover:from-indigo-500 hover:to-indigo-700', border: 'border-indigo-400' },
  { bg: 'from-cyan-400 to-cyan-600', light: 'from-cyan-50 to-cyan-100', hover: 'hover:from-cyan-500 hover:to-cyan-700', border: 'border-cyan-400' },
  { bg: 'from-pink-400 to-pink-600', light: 'from-pink-50 to-pink-100', hover: 'hover:from-pink-500 hover:to-pink-700', border: 'border-pink-400' },
];

export default function PlannerPage() {
  const [projects, setProjects] = useState<PlannerProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [categories, setCategories] = useState<PlannerCategory[]>([]);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');

  // Viewport controls: show 6 weeks at a time
  const VIEWPORT_WEEKS = 6;
  const [viewportStart, setViewportStart] = useState(startOfWeek(new Date()));

  // Modal states
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PlannerCategory | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PlannerTask | null>(null);
  const [editingProjectDates, setEditingProjectDates] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Category collapse states
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [hasInitializedCollapse, setHasInitializedCollapse] = useState(false);

  // Form states
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', color_index: 0, custom_color: '' });
  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    category_id: ''
  });

  useEffect(() => {
    const initPage = async () => {
      await checkAdminStatus();
      await fetchProjects();
      setIsLoading(false);
    };
    initPage();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchCategories();
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchTasks();
  }, [categories]);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin(profile?.role === 'admin');
    }
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('planner_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return;
    }

    setProjects(data || []);
    if (data && data.length > 0 && !selectedProjectId) {
      setSelectedProjectId(data[0].id);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('planner_categories')
      .select('*')
      .eq('project_id', selectedProjectId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    setCategories(data || []);
    
    // Collapse all categories on initial load
    if (!hasInitializedCollapse && data && data.length > 0) {
      const allCategoryIds = new Set(data.map(cat => cat.id));
      setCollapsedCategories(allCategoryIds);
      setHasInitializedCollapse(true);
    }
  };

  const fetchTasks = async () => {
    const categoryIds = categories.map(c => c.id);
    if (categoryIds.length === 0) {
      setTasks([]);
      return;
    }

    const { data, error } = await supabase
      .from('planner_tasks')
      .select('*')
      .in('category_id', categoryIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }

    setTasks(data || []);
  };

  const createProject = async () => {
    if (!projectForm.name.trim()) return;

    const { error } = await supabase
      .from('planner_projects')
      .insert([{
        name: projectForm.name,
        description: projectForm.description || null,
        created_by: currentUser,
        updated_by: currentUser
      }]);

    if (error) {
      console.error('Error creating project:', error);
      return;
    }

    setProjectForm({ name: '', description: '' });
    setShowProjectModal(false);
    await fetchProjects();
  };

  const updateProjectDates = async (projectId: string, startDate: string | null, endDate: string | null) => {
    const { error } = await supabase
      .from('planner_projects')
      .update({
        start_date: startDate,
        end_date: endDate
      })
      .eq('id', projectId);

    if (error) {
      console.error('Error updating project dates:', error);
      alert(`Failed to update project dates: ${error.message}`);
      return;
    }

    await fetchProjects();
    setEditingProjectDates(false);
  };

  const createCategory = async () => {
    if (!categoryForm.name.trim() || !selectedProjectId) return;

    const { error } = await supabase
      .from('planner_categories')
      .insert([{
        project_id: selectedProjectId,
        name: categoryForm.name,
        sort_order: categories.length,
        color_index: categoryForm.color_index,
        custom_color: categoryForm.custom_color || null,
        created_by: currentUser,
        updated_by: currentUser
      }]);

    if (error) {
      console.error('Error creating category:', error);
      alert(`Failed to create category: ${error.message}`);
      return;
    }

    setCategoryForm({ name: '', color_index: 0, custom_color: '' });
    setShowCategoryModal(false);
    await fetchCategories();
  };

  const updateCategory = async () => {
    if (!editingCategory) return;

    const { error } = await supabase
      .from('planner_categories')
      .update({
        name: editingCategory.name,
        color_index: editingCategory.color_index,
        custom_color: editingCategory.custom_color || null,
        updated_by: currentUser
      })
      .eq('id', editingCategory.id);

    if (error) {
      console.error('Error updating category:', error);
      alert(`Failed to update category: ${error.message}`);
      return;
    }

    setEditingCategory(null);
    setShowEditCategoryModal(false);
    await fetchCategories();
  };

  const createTask = async () => {
    if (!taskForm.name.trim() || !taskForm.category_id) return;

    const { error } = await supabase
      .from('planner_tasks')
      .insert([{
        category_id: taskForm.category_id,
        name: taskForm.name,
        description: taskForm.description || null,
        start_date: taskForm.start_date,
        end_date: taskForm.end_date,
        created_by: currentUser,
        updated_by: currentUser
      }]);

    if (error) {
      console.error('Error creating task:', error);
      return;
    }

    setTaskForm({
      name: '',
      description: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      category_id: ''
    });
    setShowTaskModal(false);
    await fetchTasks();
  };

  const completeTask = async (taskId: string, isCompleted: boolean) => {
    const { error } = await supabase
      .from('planner_tasks')
      .update({
        completed_date: isCompleted ? format(new Date(), 'yyyy-MM-dd') : null,
        updated_by: currentUser
      })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      return;
    }

    await fetchTasks();
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    const { error } = await supabase
      .from('planner_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error);
      return;
    }

    await fetchTasks();
    if (selectedTask && selectedTask.id === taskId) {
      setShowTaskDetailModal(false);
      setSelectedTask(null);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<PlannerTask>) => {
    const { error } = await supabase
      .from('planner_tasks')
      .update({
        ...updates,
        updated_by: currentUser
      })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      return;
    }

    await fetchTasks();
  };

  const toggleCategoryCollapse = (categoryId: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(categoryId)) {
      newCollapsed.delete(categoryId);
    } else {
      newCollapsed.add(categoryId);
    }
    setCollapsedCategories(newCollapsed);
  };

  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedCategoryIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedCategoryIndex === null || draggedCategoryIndex === dropIndex) {
      setDraggedCategoryIndex(null);
      return;
    }

    const newCategories = [...categories];
    const [draggedCategory] = newCategories.splice(draggedCategoryIndex, 1);
    newCategories.splice(dropIndex, 0, draggedCategory);

    // Update sort_order in database
    await updateCategorySortOrder(newCategories);
    setCategories(newCategories);
    setDraggedCategoryIndex(null);
  };

  const updateCategorySortOrder = async (orderedCategories: PlannerCategory[]) => {
    const updates = orderedCategories.map((cat, index) => ({
      id: cat.id,
      sort_order: index
    }));

    for (const update of updates) {
      await supabase
        .from('planner_categories')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id);
    }
  };

  const openTaskDetail = (task: PlannerTask) => {
    setSelectedTask(task);
    setShowTaskDetailModal(true);
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return CATEGORY_COLORS[0];
    
    // If custom color exists, create a color object from it
    if (category.custom_color) {
      return {
        bg: `from-[${category.custom_color}] to-[${category.custom_color}]`,
        light: `from-[${category.custom_color}]/10 to-[${category.custom_color}]/20`,
        hover: `hover:from-[${category.custom_color}] hover:to-[${category.custom_color}]`,
        border: `border-[${category.custom_color}]`
      };
    }
    
    const colorIndex = category.color_index ?? 0;
    return CATEGORY_COLORS[colorIndex % CATEGORY_COLORS.length];
  };

  // Generate viewport weeks
  const viewportEnd = addWeeks(viewportStart, VIEWPORT_WEEKS);
  const viewportDays = eachDayOfInterval({ start: viewportStart, end: addDays(viewportEnd, -1) });

  const weeks = useMemo(() => {
    const weeksList = [];
    let currentStart = startOfWeek(viewportStart);

    for (let i = 0; i < VIEWPORT_WEEKS; i++) {
      const weekEnd = endOfWeek(currentStart);
      weeksList.push({
        start: currentStart,
        end: weekEnd,
        days: eachDayOfInterval({ start: currentStart, end: weekEnd })
      });
      currentStart = addDays(weekEnd, 1);
    }

    return weeksList;
  }, [viewportStart]);

  const getTaskPosition = (task: PlannerTask) => {
    const taskStart = parseISO(task.start_date);
    const taskEnd = parseISO(task.end_date);
    
    const startIndex = viewportDays.findIndex(d => isSameDay(d, taskStart));
    const endIndex = viewportDays.findIndex(d => isSameDay(d, taskEnd));

    if (startIndex === -1 || endIndex === -1) {
      // Task is partially or fully outside viewport
      const beforeViewport = isBefore(taskEnd, viewportStart);
      const afterViewport = isBefore(viewportEnd, taskStart);
      
      if (beforeViewport || afterViewport) return null;

      // Partially visible
      return {
        startIndex: Math.max(0, startIndex === -1 ? 0 : startIndex),
        endIndex: Math.min(viewportDays.length - 1, endIndex === -1 ? viewportDays.length - 1 : endIndex),
        partial: true
      };
    }

    return {
      startIndex: Math.max(0, startIndex),
      endIndex: Math.min(viewportDays.length - 1, endIndex),
      partial: false
    };
  };

  const isTaskOverdue = (task: PlannerTask) => {
    if (task.completed_date) return false;
    return isBefore(parseISO(task.end_date), new Date());
  };

  const groupedTasks = useMemo(() => {
    return categories.map(category => ({
      category,
      tasks: tasks.filter(t => t.category_id === category.id),
      isCollapsed: collapsedCategories.has(category.id)
    }));
  }, [categories, tasks, collapsedCategories]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center text-2xl font-bold text-gray-900">
            <FolderKanban className="mr-2" size={28} />
            Project Planner
          </h1>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowProjectModal(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={16} className="mr-2" />
                New Project
              </button>
              {selectedProjectId && (
                <>
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    disabled={!selectedProjectId}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Plus size={16} className="mr-2" />
                    Category
                  </button>
                  <button
                    onClick={() => setShowTaskModal(true)}
                    disabled={categories.length === 0}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    <Plus size={16} className="mr-2" />
                    Task
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {projects.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Project</label>
            <div className="relative">
              <FolderKanban className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </div>
        )}

        {/* Project Dates */}
        {selectedProjectId && (() => {
          const selectedProject = projects.find(p => p.id === selectedProjectId);
          if (!selectedProject) return null;

          return (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Project Timeline</h3>
                {isAdmin && !editingProjectDates && (
                  <button
                    onClick={() => setEditingProjectDates(true)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                )}
              </div>
              
              {editingProjectDates ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      defaultValue={selectedProject.start_date || ''}
                      onChange={(e) => selectedProject.start_date = e.target.value}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      defaultValue={selectedProject.end_date || ''}
                      onChange={(e) => selectedProject.end_date = e.target.value}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <button
                      onClick={() => updateProjectDates(
                        selectedProject.id,
                        selectedProject.start_date || null,
                        selectedProject.end_date || null
                      )}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingProjectDates(false)}
                      className="flex-1 px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-600">Start:</span>
                    <div className="font-medium text-gray-900">
                      {selectedProject.start_date ? format(parseISO(selectedProject.start_date), 'MMM d, yyyy') : 'Not set'}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">End:</span>
                    <div className="font-medium text-gray-900">
                      {selectedProject.end_date ? format(parseISO(selectedProject.end_date), 'MMM d, yyyy') : 'Not set'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Gantt Chart */}
      {selectedProjectId && (
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex h-full">
            {/* Left Column - Frozen */}
            <div className="w-72 flex-shrink-0 bg-white/50 backdrop-blur-sm border-r border-gray-200/50 flex flex-col">
              {/* Header */}
              <div className="sticky top-0 bg-white/90 backdrop-blur-md p-4 font-bold text-base text-gray-900 h-20 flex items-center z-10">
                Tasks
              </div>
              {/* Content */}
              <div className="overflow-y-auto flex-1 pt-6">
                  {groupedTasks.map((group, groupIdx) => (
                    <div key={groupIdx}>
                      {/* Category Header */}
                      <div 
                        draggable={isAdmin}
                        onDragStart={() => handleDragStart(groupIdx)}
                        onDragOver={(e) => handleDragOver(e, groupIdx)}
                        onDrop={(e) => handleDrop(e, groupIdx)}
                        className={`bg-gradient-to-r ${getCategoryColor(group.category.id).light} h-12 px-4 font-bold text-sm text-gray-800 flex items-center cursor-pointer transition-all duration-200 hover:shadow-md ${getCategoryColor(group.category.id).border} border-l-4 ${isAdmin ? 'cursor-move' : ''} ${draggedCategoryIndex === groupIdx ? 'opacity-50' : ''}`}
                        onClick={(e) => {
                          if (isAdmin && (e.ctrlKey || e.metaKey)) {
                            setEditingCategory(group.category);
                            setShowEditCategoryModal(true);
                          } else {
                            toggleCategoryCollapse(group.category.id);
                          }
                        }}
                      >
                        {group.isCollapsed ? (
                          <ChevronRightIcon size={16} className="mr-2" />
                        ) : (
                          <ChevronDown size={16} className="mr-2" />
                        )}
                        {group.category.name}
                        <span className="ml-2 text-xs text-gray-500">({group.tasks.length})</span>
                      </div>

                      {/* Tasks in Category */}
                      {!group.isCollapsed && group.tasks.map((task, taskIdx) => {
                        const isOverdue = isTaskOverdue(task);
                        const isCompleted = task.completed_date !== null;

                        return (
                          <div
                            key={taskIdx}
                            className={`px-4 h-14 flex items-center gap-3 text-sm hover:bg-white/60 group transition-all duration-150 bg-gradient-to-r ${getCategoryColor(group.category.id).light} bg-opacity-30`}
                          >
                            {isAdmin && (
                              <input
                                type="checkbox"
                                checked={isCompleted}
                                onChange={(e) => completeTask(task.id, e.target.checked)}
                                className="w-4 h-4 rounded flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => openTaskDetail(task)}
                            >
                              <div className={`font-medium truncate ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                                {task.name}
                              </div>
                              {isOverdue && (
                                <div className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                                  <AlertCircle size={12} />
                                  OVERDUE
                                </div>
                              )}
                            </div>
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTask(task.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-600 transition-opacity"
                                title="Delete task"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column - Scrollable Timeline */}
              <div className="flex-1 overflow-x-auto flex flex-col bg-gradient-to-br from-white to-gray-50/30">
                {/* Navigation and Headers */}
                <div className="flex items-stretch sticky top-0 z-10 bg-white/95 backdrop-blur-md">
                  <button
                    onClick={() => setViewportStart(addWeeks(viewportStart, -1))}
                    className="p-3 hover:bg-gray-200 flex-shrink-0"
                    title="Previous week"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <div className="flex-1 flex flex-col shadow-sm border-l border-gray-200">
                    {/* Month row */}
                    <div className="flex h-8 items-center border-b border-gray-200">
                      {viewportDays.reduce((acc, day, idx) => {
                        const monthKey = format(day, 'MMMM yyyy');
                        const prevDay = idx > 0 ? viewportDays[idx - 1] : null;
                        const prevMonth = prevDay ? format(prevDay, 'MMMM yyyy') : null;
                        
                        if (idx === 0 || monthKey !== prevMonth) {
                          // Find how many days in this month section
                          let monthDayCount = 1;
                          for (let i = idx + 1; i < viewportDays.length; i++) {
                            if (format(viewportDays[i], 'MMMM yyyy') === monthKey) {
                              monthDayCount++;
                            } else {
                              break;
                            }
                          }
                          acc.push(
                            <div
                              key={`month-${idx}`}
                              className="text-xs font-bold text-gray-700 px-2 flex items-center"
                              style={{ width: `${monthDayCount * 70}px`, flexShrink: 0 }}
                            >
                              {format(day, 'MMMM yyyy')}
                            </div>
                          );
                        }
                        return acc;
                      }, [] as JSX.Element[])}
                    </div>
                    
                    {/* Day row */}
                    <div className="flex h-12 items-center">
                      {viewportDays.map((day, dayIdx) => {
                        const isToday = isSameDay(day, new Date());
                        return (
                          <div
                            key={dayIdx}
                            className={`p-2 text-center text-xs font-medium transition-all duration-200 ${
                              isToday ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg scale-105 rounded-t-lg mx-0.5' : 'text-gray-600'
                            }`}
                            style={{ width: '70px', flexShrink: 0 }}
                          >
                            <div className="font-bold text-[10px] uppercase tracking-wider">{format(day, 'EEE').substring(0, 3)}</div>
                            <div className={`text-lg mt-0.5 ${
                              isToday ? 'font-bold' : 'font-semibold'
                            }`}>
                              {format(day, 'd')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => setViewportStart(addWeeks(viewportStart, 1))}
                    className="p-3 hover:bg-gray-200 flex-shrink-0"
                    title="Next week"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* Task Bars Container */}
                <div className="flex-1 relative pt-6" style={{ backgroundImage: `linear-gradient(90deg, transparent 0%, transparent calc(70px - 1px), rgba(209, 213, 219, 0.3) calc(70px - 1px), rgba(209, 213, 219, 0.3) 70px)`, backgroundSize: '70px 100%', backgroundRepeat: 'repeat' }}>
                  <div style={{ minWidth: `${viewportDays.length * 70}px` }}>
                    {groupedTasks.map((group, groupIdx) => {
                      // Calculate min/max dates for category
                      let categoryMinIndex = Infinity;
                      let categoryMaxIndex = -Infinity;
                      
                      group.tasks.forEach(task => {
                        const position = getTaskPosition(task);
                        if (position) {
                          categoryMinIndex = Math.min(categoryMinIndex, position.startIndex);
                          categoryMaxIndex = Math.max(categoryMaxIndex, position.endIndex);
                        }
                      });
                      
                      const hasTasks = categoryMinIndex !== Infinity && categoryMaxIndex !== -Infinity;
                      const dayWidth = 70;
                      const categoryBarStartPx = hasTasks ? categoryMinIndex * dayWidth : 0;
                      const categoryBarWidthPx = hasTasks ? (categoryMaxIndex - categoryMinIndex + 1) * dayWidth : 0;
                      
                      return (
                      <div key={groupIdx}>
                      {/* Category spacing */}
                      <div 
                        className={`bg-gradient-to-r ${getCategoryColor(group.category.id).light} h-12 cursor-pointer hover:shadow-inner transition-all duration-200 relative`}
                        onClick={() => toggleCategoryCollapse(group.category.id)}
                      >
                        {hasTasks && (
                          <div
                            className={`absolute h-8 bg-gradient-to-r ${getCategoryColor(group.category.id).bg} rounded-full border-2 ${getCategoryColor(group.category.id).border} shadow-lg`}
                            style={{
                              left: `${categoryBarStartPx + 4}px`,
                              width: `${categoryBarWidthPx - 8}px`,
                              top: '50%',
                              transform: 'translateY(-50%)'
                            }}
                          ></div>
                        )}
                      </div>

                      {/* Tasks */}
                      {!group.isCollapsed && group.tasks.map((task, taskIdx) => {
                        const position = getTaskPosition(task);
                        const isOverdue = isTaskOverdue(task);
                        const isCompleted = task.completed_date !== null;
                        const categoryColor = getCategoryColor(task.category_id);

                        // Calculate bar width and position
                        const dayWidth = 70; // Match the fixed day column width
                        const barStartPx = position ? position.startIndex * dayWidth : 0;
                        const barWidthPx = position ? (position.endIndex - position.startIndex + 1) * dayWidth : 0;

                        return (
                          <div key={taskIdx} className="h-14 flex items-center hover:bg-white/40 transition-colors relative">
                            {position && (
                              <div
                                onClick={() => openTaskDetail(task)}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredTaskId(task.id);
                                  setTooltipPos({ x: rect.left, y: rect.top });
                                }}
                                onMouseLeave={() => setHoveredTaskId(null)}
                                className={`h-8 absolute cursor-pointer transition-all duration-300 rounded-full ${
                                  isCompleted
                                    ? 'bg-gradient-to-r from-green-400 to-emerald-500 shadow-md hover:shadow-xl hover:scale-105 opacity-70'
                                    : isOverdue
                                    ? 'bg-gradient-to-r from-red-400 to-rose-500 shadow-md hover:shadow-xl hover:scale-105'
                                    : `bg-gradient-to-r ${categoryColor.bg} shadow-lg hover:shadow-2xl hover:scale-105 ${categoryColor.hover}`
                                }`}
                                style={{
                                  left: `${barStartPx + 4}px`,
                                  width: `${barWidthPx - 8}px`,
                                  top: '50%',
                                  transform: 'translateY(-50%)'
                                }}
                              >
                              </div>
                            )}
                            {hoveredTaskId === task.id && position && (
                              <div className="fixed bg-gray-900 text-white rounded-lg shadow-2xl p-3 z-50 text-sm max-w-xs pointer-events-none" style={{
                                left: `${tooltipPos.x}px`,
                                top: `${tooltipPos.y - 100}px`
                              }}>
                                <div className="font-semibold mb-1">{task.name}</div>
                                {task.description && <div className="text-gray-200 text-xs mb-2">{task.description}</div>}
                                <div className="text-gray-300 text-xs">
                                  {format(parseISO(task.start_date), 'MMM d, yyyy')} → {format(parseISO(task.end_date), 'MMM d, yyyy')}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* Modals */}
      {showProjectModal && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">New Project</h2>
            <input
              type="text"
              placeholder="Project name"
              value={projectForm.name}
              onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mb-3 focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Description"
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={createProject}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowProjectModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">New Category</h2>
            <input
              type="text"
              placeholder="Category name"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
            />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Color</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {CATEGORY_COLORS.map((color, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCategoryForm({ ...categoryForm, color_index: index, custom_color: '' })}
                    className={`h-12 rounded-lg bg-gradient-to-r ${color.bg} border-2 transition-all ${
                      categoryForm.color_index === index && !categoryForm.custom_color ? 'border-gray-800 scale-110 shadow-lg' : 'border-gray-200 hover:scale-105'
                    }`}
                  />
                ))}
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">Or enter custom hex color</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="#FF5733"
                    value={categoryForm.custom_color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, custom_color: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  {categoryForm.custom_color && (
                    <div 
                      className="w-12 h-10 rounded border-2 border-gray-300"
                      style={{ backgroundColor: categoryForm.custom_color }}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={createCategory}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditCategoryModal && isAdmin && editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Edit Category</h2>
            <input
              type="text"
              placeholder="Category name"
              value={editingCategory.name}
              onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
            />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Color</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {CATEGORY_COLORS.map((color, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setEditingCategory({ ...editingCategory, color_index: index, custom_color: null })}
                    className={`h-12 rounded-lg bg-gradient-to-r ${color.bg} border-2 transition-all ${
                      editingCategory.color_index === index && !editingCategory.custom_color ? 'border-gray-800 scale-110 shadow-lg' : 'border-gray-200 hover:scale-105'
                    }`}
                  />
                ))}
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">Or enter custom hex color</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="#FF5733"
                    value={editingCategory.custom_color || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, custom_color: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  {editingCategory.custom_color && (
                    <div 
                      className="w-12 h-10 rounded border-2 border-gray-300"
                      style={{ backgroundColor: editingCategory.custom_color }}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={updateCategory}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowEditCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && isAdmin && categories.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">New Task</h2>
            <input
              type="text"
              placeholder="Task name"
              value={taskForm.name}
              onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mb-3 focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Description"
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mb-3 focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
            <select
              value={taskForm.category_id}
              onChange={(e) => setTaskForm({ ...taskForm, category_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mb-3 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={taskForm.start_date}
              onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mb-3 focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={taskForm.end_date}
              onChange={(e) => setTaskForm({ ...taskForm, end_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={createTask}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowTaskModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail/Edit Modal */}
      {showTaskDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Task Details</h2>
              <button
                onClick={() => {
                  setShowTaskDetailModal(false);
                  setSelectedTask(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
                <input
                  type="text"
                  value={selectedTask.name}
                  onChange={(e) => setSelectedTask({ ...selectedTask, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!isAdmin}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
                <textarea
                  value={selectedTask.description || ''}
                  onChange={(e) => setSelectedTask({ ...selectedTask, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={6}
                  placeholder="Add task notes or description..."
                  disabled={!isAdmin}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={selectedTask.start_date}
                    onChange={(e) => setSelectedTask({ ...selectedTask, start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={!isAdmin}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={selectedTask.end_date}
                    onChange={(e) => setSelectedTask({ ...selectedTask, end_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="flex items-center gap-2">
                  {selectedTask.completed_date ? (
                    <div className="px-3 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                      Completed on {format(parseISO(selectedTask.completed_date), 'MMM d, yyyy')}
                    </div>
                  ) : isTaskOverdue(selectedTask) ? (
                    <div className="px-3 py-2 bg-red-100 text-red-800 rounded-lg font-medium flex items-center gap-2">
                      <AlertCircle size={16} />
                      Overdue
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium">
                      In Progress
                    </div>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="flex gap-2 pt-4 border-t">
                  <button
                    onClick={() => {
                      updateTask(selectedTask.id, {
                        name: selectedTask.name,
                        description: selectedTask.description,
                        start_date: selectedTask.start_date,
                        end_date: selectedTask.end_date
                      });
                      setShowTaskDetailModal(false);
                      setSelectedTask(null);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => deleteTask(selectedTask.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      setShowTaskDetailModal(false);
                      setSelectedTask(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}