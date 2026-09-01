// =====================================================================
// JOB BOARD CONTEXT — jobs now come from Supabase (job_postings
// table), not a hardcoded list. Every screen using useJobBoard()
// keeps working unchanged.
// =====================================================================
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'Full-time' | 'Part-time' | 'Remote' | 'Contract' | 'Internship';
  department: string;
  description: string;
  requirements: string;
  applyLink?: string;
  postedBy: string;
  postedByRole: string;
  postedAt: string;
  active: boolean;
  suggestedBy?: string;
  status: 'Active' | 'Pending' | 'Closed';
}

interface JobCtx {
  jobs: Job[];
  addJob: (j: Omit<Job, 'id' | 'postedAt' | 'active'>) => Promise<void>;
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>;
  closeJob: (id: string) => Promise<void>;
}

const Ctx = createContext<JobCtx>({
  jobs: [], addJob: async () => {}, updateJob: async () => {},
  closeJob: async () => {},
});

function mapRow(r: any): Job {
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    location: r.location || '',
    type: r.job_type,
    department: r.department,
    description: r.description || '',
    requirements: r.requirements || '',
    applyLink: r.apply_link || '',
    postedBy: r.poster?.name || 'Unknown',
    postedByRole: r.poster?.role || '',
    postedAt: new Date(r.created_at).toLocaleDateString('en-CA'),
    active: r.status === 'Active',
    suggestedBy: r.status === 'Pending' ? r.poster?.name : undefined,
    status: r.status,
  };
}

export function JobBoardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);

  const loadJobs = async () => {
    const { data } = await supabase
      .from('job_postings')
      .select('*, poster:profiles!job_postings_posted_by_fkey(name, role)')
      .order('created_at', { ascending: false });
    setJobs((data || []).map(mapRow));
  };

  useEffect(() => { loadJobs(); }, []);

  const addJob = async (j: Omit<Job, 'id' | 'postedAt' | 'active'>) => {
    if (!user) return;
    await supabase.from('job_postings').insert({
      title: j.title, company: j.company, location: j.location,
      job_type: j.type, department: j.department, description: j.description,
      requirements: j.requirements, apply_link: j.applyLink || null,
      status: j.status, posted_by: user.id,
    });
    await loadJobs();
  };

  const updateJob = async (id: string, updates: Partial<Job>) => {
    const patch: any = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.company !== undefined) patch.company = updates.company;
    if (updates.location !== undefined) patch.location = updates.location;
    if (updates.type !== undefined) patch.job_type = updates.type;
    if (updates.department !== undefined) patch.department = updates.department;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.requirements !== undefined) patch.requirements = updates.requirements;
    if (updates.applyLink !== undefined) patch.apply_link = updates.applyLink || null;
    if (updates.status !== undefined) patch.status = updates.status;
    await supabase.from('job_postings').update(patch).eq('id', id);
    await loadJobs();
  };

  const closeJob = async (id: string) => {
    await supabase.from('job_postings').update({ status: 'Closed' }).eq('id', id);
    await loadJobs();
  };

  return <Ctx.Provider value={{ jobs, addJob, updateJob, closeJob }}>{children}</Ctx.Provider>;
}

export const useJobBoard = () => useContext(Ctx);
