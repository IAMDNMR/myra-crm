import { z } from 'zod';

export const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').or(z.literal('')).optional().nullable(),
  phone: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
  source: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  website: z.string().url('Invalid URL').or(z.literal('')).optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
});

export const dealSchema = z.object({
  name: z.string().min(1, 'Deal name is required'),
  value: z.coerce.number().min(0, 'Value must be positive'),
  pipeline_id: z.string().uuid().optional().nullable(),
  stage_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
  close_date: z.string().optional().nullable(),
  probability: z.coerce.number().min(0).max(100).optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  type: z.enum(['call', 'email', 'meeting', 'follow_up', 'demo', 'other']),
  due_date: z.string().min(1, 'Due date is required'),
  priority: z.enum(['high', 'medium', 'low']),
  status_id: z.string().uuid().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
});

export const activitySchema = z.object({
  type: z.enum(['email', 'call', 'meeting', 'note', 'task']),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
});

export type ContactFormData = z.infer<typeof contactSchema>;
export type CompanyFormData = z.infer<typeof companySchema>;
export type DealFormData = z.infer<typeof dealSchema>;
export type TaskFormData = z.infer<typeof taskSchema>;
export type ActivityFormData = z.infer<typeof activitySchema>;

export function getFieldErrors(result: z.SafeParseError<any>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
