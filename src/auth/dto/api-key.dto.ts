import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Body of `POST /api/keys`. */
export const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100).describe('A label to recognise the key, e.g. "dashboard"'),
});

/** DTO for {@link CreateApiKeySchema}. */
export class CreateApiKeyDto extends createZodDto(CreateApiKeySchema) {}

/** `:id` route parameter for API keys. */
export const ApiKeyIdParamSchema = z.object({ id: z.uuid() });

/** DTO for {@link ApiKeyIdParamSchema}. */
export class ApiKeyIdParamDto extends createZodDto(ApiKeyIdParamSchema) {}

const ApiKeyViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string().describe('First characters of the key, for recognition'),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
});

/** Response shape of an API key. */
export class ApiKeyViewDto extends createZodDto(ApiKeyViewSchema) {}

/** Response of `POST /api/keys`, including the plaintext key (shown once). */
export class CreatedApiKeyDto extends createZodDto(
  ApiKeyViewSchema.extend({ key: z.string().describe('The API key. Store it now; it cannot be shown again.') }),
) {}
