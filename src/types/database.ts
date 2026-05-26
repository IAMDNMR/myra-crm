export type AppRole = 'admin' | 'manager' | 'rep' | 'read_only';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  avatar_url: string | null;
  teams_webhook_url: string | null;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  website: string | null;
  owner_id: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  owner_id: string | null;
  source: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  order_index: number;
  probability: number;
  color: string | null;
}

export interface Deal {
  id: string;
  name: string;
  value: number;
  stage_id: string | null;
  pipeline_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  owner_id: string | null;
  close_date: string | null;
  probability: number;
  status: 'open' | 'won' | 'lost';
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'task';
  subject: string | null;
  body: string | null;
  deal_id: string | null;
  contact_id: string | null;
  user_id: string | null;
  logged_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  type: 'call' | 'email' | 'meeting' | 'follow_up' | 'demo' | 'other';
  due_date: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'done' | 'cancelled';
  assignee_id: string | null;
  deal_id: string | null;
  contact_id: string | null;
  created_at: string;
}

export interface DealStageHistory {
  id: string;
  deal_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  changed_by: string | null;
  changed_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  created_by: string | null;
  created_at: string;
}
