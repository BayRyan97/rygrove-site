import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, addDays, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isBefore } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Plus, ChevronLeft, ChevronRight, Calendar, FolderKanban, AlertCircle } from 'lucide-react';

interface PlannerProject {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
}

interface PlannerCategory {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
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
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Form states
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
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
      fetchTasks();
    }
  }, [selectedProjectId]);

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
      .order('start_date', { ascending: true });

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

  const createCategory = async () => {
    if (!categoryForm.name.trim() || !selectedProjectId) return;

    const { error } = await supabase
      .from('planner_categories')
      .insert([{
        project_id: selectedProjectId,
        name: categoryForm.name,
        sort_order: categories.length,
        created_by: currentUser,
        updated_by: currentUser
      }]);

    if (error) {
      console.error('Error creating category:', error);
      return;
    }

    setCategoryForm({ name: '' });
    setShowCategoryModal(false);
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
      tasks: tasks.filter(t => t.category_id === category.id)
    }));
  }, [categories, tasks]);

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
            <button
              onClick={() => setShowProjectModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} className="mr-2" />
              New Project
            </button>
          )}
        </div>

        {projects.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range Navigation */}
        <div className="flex items-center justify-between bg-gray-100 rounded-lg p-4">
          <button
            onClick={() => setViewportStart(addWeeks(viewportStart, -1))}
            className="p-2 hover:bg-gray-200 rounded-lg"
            title="Previous week"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-3 flex-1 justify-center">
            <button
              onClick={() => setViewportStart(startOfWeek(new Date()))}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 border border-gray-300"
            >
              <Calendar size={16} className="mr-2" />
              Today
            </button>
            <span className="text-sm font-medium text-gray-700">
              {format(viewportStart, 'MMM d')} - {format(addDays(viewportEnd, -1), 'MMM d, yyyy')}
            </span>
          </div>

          <button
            onClick={() => setViewportStart(addWeeks(viewportStart, 1))}
            className="p-2 hover:bg-gray-200 rounded-lg"
            title="Next week"
          >
            <ChevronRight size={20} />
          </button>

          {isAdmin && (
            <div className="flex gap-2 ml-4">
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
            </div>
          )}
        </div>
      </div>

      {/* Gantt Chart */}
      {selectedProjectId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-hidden">
            <div className="flex">
              {/* Task Names Column */}
              <div className="w-64 flex-shrink-0 border-r border-gray-200">
                {/* Header */}
                <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-3 font-medium text-sm text-gray-700 h-16 flex items-center z-10">
                  Tasks
                </div>

                {/* Tasks */}
                <div>
                  {groupedTasks.map((group, groupIdx) => (
                    <div key={groupIdx}>
                      {/* Category Header */}
                      <div className="bg-gray-100 border-b border-gray-200 p-3 font-semibold text-sm text-gray-800">
                        {group.category.name}
                      </div>

                      {/* Tasks in Category */}
                      {group.tasks.map((task, taskIdx) => {
                        const isOverdue = isTaskOverdue(task);
                        const isCompleted = task.completed_date !== null;

                        return (
                          <div
                            key={taskIdx}
                            className="border-b border-gray-100 p-3 min-h-12 flex items-center gap-2 text-sm hover:bg-gray-50"
                          >
                            {isAdmin && (
                              <input
                                type="checkbox"
                                checked={isCompleted}
                                onChange={(e) => completeTask(task.id, e.target.checked)}
                                className="w-4 h-4 rounded flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
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
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="flex-1 min-w-0">
                {/* Week/Day Headers */}
                <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
                  {/* Week row */}
                  <div className="flex border-b border-gray-200">
                    {weeks.map((week, weekIdx) => (
                      <div
                        key={weekIdx}
                        className="flex-1 border-r border-gray-200 py-2 px-2"
                        style={{ minWidth: `${(week.days.length * 100) / 42}%` }}
                      >
                        <div className="text-xs font-semibold text-gray-600 truncate">
                          {format(week.start, 'MMM d')} - {format(week.end, 'd')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Day row */}
                  <div className="flex">
                    {viewportDays.map((day, dayIdx) => (
                      <div
                        key={dayIdx}
                        className={`flex-1 border-r border-gray-100 p-1 text-center text-xs font-medium ${
                          isSameDay(day, new Date()) ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'bg-gray-50'
                        }`}
                        style={{ minWidth: '60px' }}
                      >
                        <div className="font-semibold">{format(day, 'EEE').substring(0, 1)}</div>
                        <div className={isSameDay(day, new Date()) ? 'text-blue-600 font-bold' : ''}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Task Bars */}
                <div>
                  {groupedTasks.map((group, groupIdx) => (
                    <div key={groupIdx}>
                      {/* Category spacing */}
                      <div className="bg-gray-100 border-b border-gray-200 h-10"></div>

                      {/* Tasks */}
                      {group.tasks.map((task, taskIdx) => {
                        const position = getTaskPosition(task);
                        const isOverdue = isTaskOverdue(task);
                        const isCompleted = task.completed_date !== null;

                        return (
                          <div key={taskIdx} className="flex border-b border-gray-100 min-h-12 items-center">
                            {viewportDays.map((day, dayIdx) => {
                              const isInRange = position && dayIdx >= position.startIndex && dayIdx <= position.endIndex;
                              const isStart = position && dayIdx === position.startIndex;

                              return (
                                <div
                                  key={dayIdx}
                                  className={`flex-1 border-r border-gray-100 p-1`}
                                  style={{ minWidth: '60px' }}
                                >
                                  {isInRange && (
                                    <div
                                      className={`h-8 rounded px-2 text-xs font-medium text-white flex items-center justify-center truncate ${
                                        isCompleted
                                          ? 'bg-green-500'
                                          : isOverdue
                                          ? 'bg-red-500'
                                          : 'bg-blue-500'
                                      }`}
                                    >
                                      {isStart && task.name.substring(0, 6)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
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
              onChange={(e) => setCategoryForm({ name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
            />
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
    </div>
  );
}