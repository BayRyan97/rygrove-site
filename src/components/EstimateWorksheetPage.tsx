import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Download, FolderOpen, Copy, ChevronDown, ChevronRight, FilePlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface WorksheetRow {
  id: string;
  item: string;
  cost: number;
}

interface SavedEstimate {
  id: string;
  job_name: string;
  created_at: string;
  updated_at: string;
  total: number;
  user_id: string;
}

interface GroupedEstimates {
  [jobName: string]: SavedEstimate[];
}

export function EstimateWorksheetPage() {
  const [jobName, setJobName] = useState('');
  const [currentEstimateId, setCurrentEstimateId] = useState<string | null>(null);
  const [rows, setRows] = useState<WorksheetRow[]>([
    { id: '1', item: '', cost: 0 },
    { id: '2', item: '', cost: 0 },
    { id: '3', item: '', cost: 0 },
    { id: '4', item: '', cost: 0 },
    { id: '5', item: '', cost: 0 },
  ]);
  const [overheadPercentage, setOverheadPercentage] = useState(15);
  const [overheadInput, setOverheadInput] = useState('15');
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [costInputs, setCostInputs] = useState<{ [key: string]: string }>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadUserInfo();
    loadSavedEstimates();
  }, []);

  const loadUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile) {
      setIsAdmin(profile.role === 'admin');
    }
  };

  const loadSavedEstimates = async () => {
    const { data, error } = await supabase
      .from('estimate_worksheets')
      .select('id, job_name, created_at, updated_at, total, user_id')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setSavedEstimates(data);
    }
  };

  const getGroupedEstimates = (): GroupedEstimates => {
    const grouped: GroupedEstimates = {};

    savedEstimates.forEach(estimate => {
      const baseJobName = estimate.job_name.replace(/ v\d+$/, '');
      if (!grouped[baseJobName]) {
        grouped[baseJobName] = [];
      }
      grouped[baseJobName].push(estimate);
    });

    Object.keys(grouped).forEach(jobName => {
      grouped[jobName].sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });

    return grouped;
  };

  const getNextVersionNumber = (baseJobName: string): number => {
    const versions = savedEstimates
      .filter(e => e.job_name.startsWith(baseJobName))
      .map(e => {
        const match = e.job_name.match(/ v(\d+)$/);
        return match ? parseInt(match[1]) : 1;
      });

    return versions.length > 0 ? Math.max(...versions) + 1 : 2;
  };

  const toggleJobExpansion = (jobName: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobName)) {
      newExpanded.delete(jobName);
    } else {
      newExpanded.add(jobName);
    }
    setExpandedJobs(newExpanded);
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const parseCurrencyInput = (value: string): number => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleCostInputChange = (id: string, value: string) => {
    setCostInputs({ ...costInputs, [id]: value });
  };

  const handleCostBlur = (id: string) => {
    const value = costInputs[id] || '0';
    const numericValue = parseCurrencyInput(value);
    setRows(rows.map(row =>
      row.id === id ? { ...row, cost: numericValue } : row
    ));
    const newInputs = { ...costInputs };
    delete newInputs[id];
    setCostInputs(newInputs);
  };

  const handleItemChange = (id: string, value: string) => {
    setRows(rows.map(row =>
      row.id === id ? { ...row, item: value } : row
    ));
  };

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      const lines = value.substring(0, start).split('\n');
      const currentLine = lines[lines.length - 1];

      let bulletPrefix = '\n• ';
      if (currentLine.trim().startsWith('•')) {
        bulletPrefix = '\n• ';
      } else if (currentLine.trim().startsWith('-')) {
        bulletPrefix = '\n- ';
      } else if (currentLine.trim() === '') {
        bulletPrefix = '\n• ';
      }

      const newValue = value.substring(0, start) + bulletPrefix + value.substring(end);
      handleItemChange(id, newValue);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + bulletPrefix.length;
      }, 0);
    }
  };

  const handleOverheadInputChange = (value: string) => {
    setOverheadInput(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      setOverheadPercentage(parsed);
    }
  };

  const handleOverheadBlur = () => {
    const parsed = parseFloat(overheadInput);
    if (isNaN(parsed) || parsed < 0) {
      setOverheadInput(overheadPercentage.toString());
    } else {
      setOverheadPercentage(parsed);
      setOverheadInput(parsed.toString());
    }
  };

  const addRow = () => {
    const newId = (Math.max(...rows.map(r => parseInt(r.id)), 0) + 1).toString();
    setRows([...rows, { id: newId, item: '', cost: 0 }]);
  };

  const deleteRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const subtotal = rows.reduce((sum, row) => sum + row.cost, 0);
  const overheadAmount = (subtotal * overheadPercentage) / 100;
  const total = subtotal + overheadAmount;

  const saveEstimate = async () => {
    if (!jobName.trim()) {
      setSaveMessage('Please enter a job name');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const estimateData = {
      user_id: user.id,
      job_name: jobName,
      items: rows,
      overhead_percentage: overheadPercentage,
      subtotal,
      overhead_amount: overheadAmount,
      total,
      updated_at: new Date().toISOString(),
    };

    if (currentEstimateId) {
      const { error } = await supabase
        .from('estimate_worksheets')
        .update(estimateData)
        .eq('id', currentEstimateId);

      if (!error) {
        setSaveMessage('Estimate updated successfully!');
        loadSavedEstimates();
      } else {
        setSaveMessage('Error updating estimate');
      }
    } else {
      const { data, error } = await supabase
        .from('estimate_worksheets')
        .insert(estimateData)
        .select()
        .single();

      if (!error && data) {
        setCurrentEstimateId(data.id);
        setSaveMessage('Estimate saved successfully!');
        loadSavedEstimates();
      } else {
        setSaveMessage('Error saving estimate');
      }
    }

    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleSaveAs = () => {
    const baseJobName = jobName.replace(/ v\d+$/, '');
    const nextVersion = getNextVersionNumber(baseJobName);
    setSaveAsName(`${baseJobName} v${nextVersion}`);
    setShowSaveAsModal(true);
  };

  const confirmSaveAs = async () => {
    if (!saveAsName.trim()) {
      setSaveMessage('Please enter a job name');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const estimateData = {
      user_id: user.id,
      job_name: saveAsName,
      items: rows,
      overhead_percentage: overheadPercentage,
      subtotal,
      overhead_amount: overheadAmount,
      total,
    };

    const { data, error } = await supabase
      .from('estimate_worksheets')
      .insert(estimateData)
      .select()
      .single();

    if (!error && data) {
      setCurrentEstimateId(data.id);
      setJobName(saveAsName);
      setSaveMessage('Estimate saved as new version!');
      loadSavedEstimates();
      setShowSaveAsModal(false);
    } else {
      setSaveMessage('Error saving estimate');
    }

    setTimeout(() => setSaveMessage(''), 3000);
  };

  const duplicateEstimate = async (estimateId: string) => {
    const { data: estimateData, error: fetchError } = await supabase
      .from('estimate_worksheets')
      .select('*')
      .eq('id', estimateId)
      .single();

    if (fetchError || !estimateData) {
      setSaveMessage('Error loading estimate');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const baseJobName = estimateData.job_name.replace(/ v\d+$/, '');
    const nextVersion = getNextVersionNumber(baseJobName);

    const newEstimateData = {
      user_id: user.id,
      job_name: `${baseJobName} v${nextVersion}`,
      items: estimateData.items,
      overhead_percentage: estimateData.overhead_percentage,
      subtotal: estimateData.subtotal,
      overhead_amount: estimateData.overhead_amount,
      total: estimateData.total,
    };

    const { error } = await supabase
      .from('estimate_worksheets')
      .insert(newEstimateData);

    if (!error) {
      setSaveMessage('Estimate duplicated successfully!');
      loadSavedEstimates();
    } else {
      setSaveMessage('Error duplicating estimate');
    }

    setTimeout(() => setSaveMessage(''), 3000);
  };

  const deleteEstimate = async (estimateId: string) => {
    if (!confirm('Are you sure you want to delete this estimate?')) {
      return;
    }

    const { error } = await supabase
      .from('estimate_worksheets')
      .delete()
      .eq('id', estimateId);

    if (!error) {
      setSaveMessage('Estimate deleted successfully!');
      loadSavedEstimates();
      if (currentEstimateId === estimateId) {
        startNewEstimate();
      }
    } else {
      setSaveMessage('Error deleting estimate');
    }

    setTimeout(() => setSaveMessage(''), 3000);
  };

  const loadEstimate = async (id: string) => {
    const { data, error } = await supabase
      .from('estimate_worksheets')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      setCurrentEstimateId(data.id);
      setJobName(data.job_name);
      setRows(data.items as WorksheetRow[]);
      const overhead = parseFloat(data.overhead_percentage);
      setOverheadPercentage(overhead);
      setOverheadInput(overhead.toString());
      setShowLoadModal(false);
    }
  };

  const exportToExcel = () => {
    if (!jobName.trim()) {
      setSaveMessage('Please enter a job name before exporting');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    const worksheetData = [
      ['Job Name:', jobName],
      [],
      ['Item', 'Cost'],
      ...rows.map(row => [row.item, row.cost]),
      [],
      ['Overhead & Profit (' + overheadPercentage + '%)', overheadAmount],
      ['Total', total],
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    ws['!cols'] = [
      { wch: 50 },
      { wch: 15 }
    ];

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = 3; R <= range.e.r; R++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: 1 });
      if (ws[cellAddress] && typeof ws[cellAddress].v === 'number') {
        ws[cellAddress].z = '$#,##0.00';
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estimate');

    const fileName = `${jobName.replace(/[^a-z0-9]/gi, '_')}_Estimate.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const startNewEstimate = () => {
    setCurrentEstimateId(null);
    setJobName('');
    setRows([
      { id: '1', item: '', cost: 0 },
      { id: '2', item: '', cost: 0 },
      { id: '3', item: '', cost: 0 },
      { id: '4', item: '', cost: 0 },
      { id: '5', item: '', cost: 0 },
    ]);
    setOverheadPercentage(15);
    setOverheadInput('15');
    setCostInputs({});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Estimate Worksheet</h2>
        <div className="flex items-center space-x-2 flex-wrap">
          <button
            onClick={() => setShowLoadModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            <span>Load</span>
          </button>
          <button
            onClick={startNewEstimate}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New</span>
          </button>
          <button
            onClick={saveEstimate}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>Save</span>
          </button>
          <button
            onClick={handleSaveAs}
            className="flex items-center space-x-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
          >
            <FilePlus className="h-4 w-4" />
            <span>Save As</span>
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className={`p-3 rounded-lg ${saveMessage.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {saveMessage}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-300 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Job Name
        </label>
        <input
          type="text"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter job name"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={addRow}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Row</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="text-left p-4 font-semibold text-gray-700">Item</th>
              <th className="text-right p-4 font-semibold text-gray-700 w-48">Cost</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="p-2">
                  <textarea
                    value={row.item}
                    onChange={(e) => handleItemChange(row.id, e.target.value)}
                    onKeyDown={(e) => handleItemKeyDown(e, row.id)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[42px]"
                    placeholder="Enter item description&#10;Press Enter to add bullets automatically"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="text"
                    value={costInputs[row.id] !== undefined ? costInputs[row.id] : (row.cost === 0 ? '' : formatCurrency(row.cost))}
                    onChange={(e) => handleCostInputChange(row.id, e.target.value)}
                    onBlur={() => handleCostBlur(row.id)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="$0.00"
                  />
                </td>
                <td className="p-2">
                  {rows.length > 1 && (
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}

            <tr className="border-t-2 border-gray-300 bg-blue-50">
              <td className="p-4">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-800">Overhead & Profit</span>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      value={overheadInput}
                      onChange={(e) => handleOverheadInputChange(e.target.value)}
                      onBlur={handleOverheadBlur}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-gray-600">%</span>
                  </div>
                </div>
              </td>
              <td className="p-4 text-right font-semibold text-gray-800">
                {formatCurrency(overheadAmount)}
              </td>
              <td></td>
            </tr>

            <tr className="bg-green-50 border-t-2 border-gray-400">
              <td className="p-4">
                <span className="font-bold text-lg text-gray-800">Total</span>
              </td>
              <td className="p-4 text-right font-bold text-lg text-green-700">
                {formatCurrency(total)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal:</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Overhead & Profit ({overheadPercentage}%):</span>
          <span className="font-medium">{formatCurrency(overheadAmount)}</span>
        </div>
        <div className="flex justify-between text-gray-800 font-bold text-base pt-2 border-t border-gray-300">
          <span>Grand Total:</span>
          <span className="text-green-700">{formatCurrency(total)}</span>
        </div>
      </div>

      {showLoadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Load Estimate</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-2">
              {savedEstimates.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No saved estimates found</p>
              ) : (
                Object.entries(getGroupedEstimates()).map(([jobName, estimates]) => (
                  <div key={jobName} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleJobExpansion(jobName)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        {expandedJobs.has(jobName) ? (
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-600" />
                        )}
                        <span className="font-semibold text-gray-800">{jobName}</span>
                        <span className="text-sm text-gray-500">({estimates.length} version{estimates.length > 1 ? 's' : ''})</span>
                      </div>
                    </button>
                    {expandedJobs.has(jobName) && (
                      <div className="divide-y divide-gray-200">
                        {estimates.map((estimate) => (
                          <div
                            key={estimate.id}
                            className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                          >
                            <button
                              onClick={() => loadEstimate(estimate.id)}
                              className="flex-1 text-left"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-gray-800">{estimate.job_name}</div>
                                  <div className="text-sm text-gray-500">
                                    Updated: {new Date(estimate.updated_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold text-green-700">{formatCurrency(estimate.total)}</div>
                                </div>
                              </div>
                            </button>
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateEstimate(estimate.id);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Duplicate this estimate"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteEstimate(estimate.id);
                                  }}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete this estimate"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showSaveAsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Save As New Version</h3>
              <button
                onClick={() => setShowSaveAsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Name
                </label>
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter job name"
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowSaveAsModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSaveAs}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
