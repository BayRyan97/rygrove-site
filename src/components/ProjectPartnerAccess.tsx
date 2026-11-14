import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProjectPartnerAccessProps {
  projectId: string;
  currentUser: string;
}

interface PartnerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

// Admin-only: choose which partner-role users can see this project.
export default function ProjectPartnerAccess({ projectId, currentUser }: ProjectPartnerAccessProps) {
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: partnerRows, error: partnerError }, { data: memberRows, error: memberError }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('role', 'partner').order('full_name'),
      supabase.from('planner_project_members').select('user_id').eq('project_id', projectId)
    ]);
    if (partnerError || memberError) {
      console.error('Error loading partner access:', partnerError || memberError);
      return;
    }
    setPartners(partnerRows || []);
    setMemberIds(new Set((memberRows || []).map(m => m.user_id)));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (userId: string, grant: boolean) => {
    setSaving(userId);
    const { error } = grant
      ? await supabase.from('planner_project_members').insert([{ project_id: projectId, user_id: userId, created_by: currentUser || null }])
      : await supabase.from('planner_project_members').delete().eq('project_id', projectId).eq('user_id', userId);
    setSaving(null);
    if (error) {
      console.error('Error updating partner access:', error);
      alert(`Could not update access: ${error.message}`);
      return;
    }
    await load();
  };

  return (
    <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg p-3 border border-violet-200">
      <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1.5">
        <Users size={14} />
        Partner Access
      </h3>
      {partners.length === 0 ? (
        <p className="text-[11px] text-gray-600">
          No partner accounts yet. Give someone the Partner role in the Admin Dashboard, then share this project with them here.
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {partners.map(p => (
            <label key={p.id} className="flex items-center gap-1.5 text-xs text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={memberIds.has(p.id)}
                disabled={saving === p.id}
                onChange={(e) => toggle(p.id, e.target.checked)}
                className="w-3.5 h-3.5 rounded"
              />
              {p.full_name || p.email}
            </label>
          ))}
        </div>
      )}
      <p className="text-[10px] text-gray-500 mt-1.5">
        Partners see this project's planner, notes (can comment), costs, and expenses for its linked jobs.
      </p>
    </div>
  );
}
