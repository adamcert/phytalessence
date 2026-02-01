import { z } from 'zod';

export const updateSettingSchema = z.object({
  value: z.string().min(1, 'Valeur requise'),
  description: z.string().optional(),
});

export const settingKeyParamSchema = z.object({
  key: z.string().min(1, 'Clé requise'),
});

export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
