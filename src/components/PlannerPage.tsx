import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isAfter, isBefore } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Plus, ChevronLeft, ChevronRight, Calendar, FolderKanban, AlertCircle, Check } from 'lucide-react';

interface PlannerProject {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
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
  created_by: string;
}

interface PlannerTaskNote {
  id: string;
  task_id: string;
  note_text: string;
  created_at: string;
}

export default function PlannerPage() {
  const [projects, setProjects] = useState<PlannerProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [categories, setCategories] = useState<PlannerCategory[]>([]);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [notes, setNotes] = useState<PlannerTaskNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');

  // Date range state
  const [rangeStart, setRangeStart] = useState(addDays(new Date(), -30));
  const [rangeEnd, setRangeEnd] = useState(addDays(new Date(), 180));

  // Modal states
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
      fetchNotes();
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

  const fetchNotes = async () => {
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length === 0) return;

    const { data, error } = await supabase
      .from('planner_task_notes')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
      return;
    }

    setNotes(data || []);
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

  // Generate week columns
  const weekStart = startOfWeek(rangeStart);
  const weekEnd = endOfWeek(rangeEnd);
  const daysInRange = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weeks = useMemo(() => {
    const weeksList = [];
    let currentWeekStart = weekStart;

    while (isBefore(currentWeekStart, weekEnd) || isSameDay(currentWeekStart, weekEnd)) {
      const currentWeekEnd = endOfWeek(currentWeekStart);
      weeksList.push({
        start: currentWeekStart,
        end: isBefore(currentWeekEnd, weekEnd) ? currentWeekEnd : weekEnd,
        days: eachDayOfInterval({
          start: currentWeekStart,
          end: isBefore(currentWeekEnd, weekEnd) ? currentWeekEnd : weekEnd
        })
      });
      currentWeekStart = addDays(currentWeekEnd, 1);
    }

    return weeksList;
  }, [weekStart, weekEnd]);

  const getTaskPosition = (task: PlannerTask) => {
    const taskStart = parseISO(task.start_date);
    const taskEnd = parseISO(task.end_date);
    
    const startIndex = daysInRange.findIndex(d => isSameDay(d, taskStart));
    const endIndex = daysInRange.findIndex(d => isSameDay(d, taskEnd));

    return {
      startIndex: Math.max(0, startIndex),
      endIndex: Math.min(daysInRange.length - 1, endIndex)
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
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
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
          <div className="mb-4">
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

        {/* Date Range Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setRangeStart(addDays(rangeStart, -7));
              setRangeEnd(addDays(rangeEnd, -7));
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={() => {
              setRangeStart(addDays(new Date(), -30));
              setRangeEnd(addDays(new Date(), 180));
            }}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <Calendar size={16} className="mr-2" />
            Today
          </button>

          <button
            onClick={() => {
              setRangeStart(addDays(rangeEnd, 1));
              setRangeEnd(addDays(rangeEnd, 1 + 211));
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight size={20} />
          </button>

          <span className="text-sm text-gray-600">
            {format(rangeStart, 'MMM d')} - {format(rangeEnd, 'MMM d, yyyy')}
          </span>

          {isAdmin && (
            <>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 ml-auto"
              >
                <Plus size={16} className="mr-2" />
                New Category
              </button>
              <button
                onClick={() => setShowTaskModal(true)}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus size={16} className="mr-2" />
                New Task
              </button>
            </>
          )}
        </div>
      </div>

      {/* Gantt Chart */}
      {selectedProjectId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <div className="min-w-max">
            {/* Week Headers */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white">
              <div className="w-64 border-r border-gray-200 bg-gray-50 p-3 font-medium text-sm text-gray-700 flex-shrink-0">
                Tasks
              </div>
              <div className="flex flex-1">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="flex border-r border-gray-200">
                    {week.days.map((day, dayIdx) => (
                      <div
                        key={dayIdx}
                        className={`w-24 p-2 text-center border-r border-gray-100 text-xs font-medium ${
                          isSameDay(day, new Date()) ? 'bg-blue-50' : 'bg-gray-50'
                        }`}
                      >
                        <div>{format(day, 'EEE')}</div>
                        <div className={isSameDay(day, new Date()) ? 'text-blue-600 font-bold' : ''}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Task Rows */}
            {groupedTasks.map((group, groupIdx) => (
              <div key={groupIdx}>
                {/* Category Header */}
                <div className="bg-gray-100 border-b border-gray-200 p-3">
                  <div className="font-semibold text-gray-800 text-sm">{group.category.name}</div>
                </div>

                {/* Tasks in Category */}
                {group.tasks.map((task, taskIdx) => {
                  const position = getTaskPosition(task);
                  const isOverdue = isTaskOverdue(task);
                  const isCompleted = task.completed_date !== null;

                  return (
                    <div key={taskIdx} className="flex border-b border-gray-100 hover:bg-gray-50">
                      {/* Task Name */}
                      <div className="w-64 border-r border-gray-200 p-3 flex-shrink-0 flex items-center gap-2">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            onChange={(e) => completeTask(task.id, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        )}
                        <button
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            setShowTaskDetail(true);
                          }}
                          className="text-left flex-1 text-sm font-medium text-gray-900 hover:text-blue-600 cursor-pointer"
                        >
                          {task.name}
                        </button>
                        {isOverdue && (
                          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                        )}
                      </div>

                      {/* Timeline */}
                      <div className="flex flex-1 relative">
                        {daysInRange.map((day, dayIdx) => (
                          <div
                            key={dayIdx}
                            className="w-24 border-r border-gray-100 p-1 relative"
                          >
                            {dayIdx >= position.startIndex && dayIdx <= position.endIndex && (
                              <div
                                className={`px-2 py-1 rounded text-xs font-medium text-white text-center ${
                                  isCompleted
                                    ? 'bg-green-500'
                                    : isOverdue
                                    ? 'bg-red-500'
                                    : 'bg-blue-500'
                                }`}
                              >
                                {dayIdx === position.startIndex && (
                                  <span>{task.name.substring(0, 3)}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
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