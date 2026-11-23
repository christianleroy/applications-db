import { z } from 'zod';
import { SALARY_PERIODS, SOURCES, STATUSES, WORK_MODES } from './enums';

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, 'Not a real calendar date');
export type IsoDate = string;

const StatusSchema = z.enum(STATUSES);
const SourceSchema = z.enum(SOURCES);
const WorkModeSchema = z.enum(WORK_MODES);

export const StatusEntrySchema = z.object({
  id: z.uuid(),
  status: StatusSchema,
  date: IsoDateSchema,
  note: z.string().optional(),
});
export type StatusEntry = z.infer<typeof StatusEntrySchema>;

export const ContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const SalarySchema = z
  .object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
    currency: z.string().length(3),
    period: z.enum(SALARY_PERIODS),
  })
  .refine((s) => s.min === undefined || s.max === undefined || s.min <= s.max, {
    message: 'Max must be at least min',
    path: ['max'],
  });
export type Salary = z.infer<typeof SalarySchema>;

const editableFields = {
  company: z.string().trim().min(1, 'Company is required'),
  role: z.string().trim().min(1, 'Role is required'),
  postingUrl: z.url().optional(),
  location: z.string().optional(),
  workMode: WorkModeSchema.optional(),
  salary: SalarySchema.optional(),
  source: SourceSchema,
  dateApplied: IsoDateSchema,
  followUpDate: IsoDateSchema.optional(),
  contacts: z.array(ContactSchema),
  notes: z.string().optional(),
};

export const ApplicationSchema = z.object({
  id: z.uuid(),
  ...editableFields,
  status: StatusSchema,
  statusHistory: z.array(StatusEntrySchema).min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Application = z.infer<typeof ApplicationSchema>;

export const CreateApplicationInputSchema = z.object({
  ...editableFields,
  contacts: z.array(ContactSchema).default([]),
});
export type CreateApplicationInput = z.infer<typeof CreateApplicationInputSchema>;

export const UpdateApplicationInputSchema = CreateApplicationInputSchema.partial();
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationInputSchema>;

export const StatusEntryInputSchema = z.object({
  status: StatusSchema,
  date: IsoDateSchema,
  note: z.string().optional(),
});
export type StatusEntryInput = z.infer<typeof StatusEntryInputSchema>;

export const StatusEntryPatchSchema = StatusEntryInputSchema.partial();
export type StatusEntryPatch = z.infer<typeof StatusEntryPatchSchema>;

export const SORT_KEYS = ['dateApplied:desc', 'dateApplied:asc', 'company:asc', 'updatedAt:desc'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const ApplicationQuerySchema = z.object({
  q: z.string().optional(),
  status: z.array(StatusSchema).optional(),
  source: z.array(SourceSchema).optional(),
  workMode: z.array(WorkModeSchema).optional(),
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  sort: z.enum(SORT_KEYS).default('dateApplied:desc'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export type ApplicationQuery = z.infer<typeof ApplicationQuerySchema>;

export const DateRangeSchema = z
  .object({ from: IsoDateSchema, to: IsoDateSchema })
  .refine((r) => r.from <= r.to, { message: 'Start date must be on or before end date', path: ['to'] });
export type DateRange = z.infer<typeof DateRangeSchema>;

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
