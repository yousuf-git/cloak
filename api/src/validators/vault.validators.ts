import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const cipher = z.string().min(1).max(8192);
const shortText = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(500).optional();

export const idParamSchema = z.object({ id: objectId });

// ---- Projects ----
export const projectCreateSchema = z.object({
  name: shortText,
  url: optionalText,
  note: optionalText,
});
export const projectUpdateSchema = projectCreateSchema.partial();

// ---- Credentials ----
export const credCreateSchema = z.object({
  name: shortText,
  url: optionalText,
  username: z.string().trim().max(512), // plaintext — not a secret; may be empty (imported rows)
  password: cipher,
  note: optionalText,
  project_id: objectId.optional(),
});
export const credUpdateSchema = credCreateSchema.partial();

// ---- API Keys ----
export const apiKeyCreateSchema = z.object({
  label: shortText,
  url: optionalText,
  key: cipher,
  note: optionalText,
  project_id: objectId.optional(),
});
export const apiKeyUpdateSchema = apiKeyCreateSchema.partial();

// ---- Platforms + backup codes ----
export const platformCreateSchema = z.object({
  name: shortText,
  note: optionalText,
  backup_codes: z.array(z.object({ encrypted_code: cipher })).max(50).optional(),
});
export const platformUpdateSchema = z.object({
  name: shortText.optional(),
  note: optionalText,
});
export const backupCodesAddSchema = z.object({
  backup_codes: z.array(z.object({ encrypted_code: cipher })).min(1).max(50),
});
export const backupCodeUsedSchema = z.object({ is_used: z.boolean() });
export const codeParamSchema = z.object({ id: objectId, codeId: objectId });

// ---- Env files ----
const envTag = z.enum(['Local', 'Staging', 'Production', 'Custom']);
const blobB64 = z.string().min(1).max(1_000_000); // ~750KB decoded ceiling

export const envListQuerySchema = z.object({ project_id: objectId.optional() });

export const envCreateSchema = z.object({
  project_id: objectId,
  label: shortText,
  tag: envTag.default('Local'),
  // null => imported pre-encrypted without a key (view-only, cannot decrypt).
  encrypted_dotenvx_key: cipher.nullable(),
  content_b64: blobB64,
  variable_count: z.number().int().min(0).max(10_000).default(0),
});

export const envUpdateSchema = z
  .object({
    label: shortText.optional(),
    tag: envTag.optional(),
    encrypted_dotenvx_key: cipher.nullable().optional(),
    content_b64: blobB64.optional(),
    variable_count: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });
