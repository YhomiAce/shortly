import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { validateSlug } from '../slug';

const targetUrl = z
  .url({ protocol: /^https?$/, error: 'Must be an absolute http(s) URL' })
  .max(2048)
  .describe('Destination URL (http or https)');

const futureDate = z.iso
  .datetime({ offset: true, error: 'Must be an ISO 8601 date-time, e.g. 2027-01-31T23:59:59Z' })
  .refine((value) => new Date(value).getTime() > Date.now(), 'Must be in the future');

const slug = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const result = validateSlug(value);
    if (!result.valid) ctx.addIssue({ code: 'custom', message: result.reason });
  })
  .describe('Custom slug (3-64 chars: letters, digits, "-", "_"). Generated when omitted.');

const password = z.string().min(4).max(128).describe('Visitors must enter this password before being redirected');
const title = z.string().trim().max(200).describe('Optional label shown in the dashboard');

/** Body of `POST /api/links`. */
export const CreateLinkSchema = z.object({
  url: targetUrl,
  slug: slug.optional(),
  title: title.optional(),
  expiresAt: futureDate.optional().describe('After this instant the link answers 410 Gone'),
  password: password.optional(),
});

/** DTO for {@link CreateLinkSchema}. */
export class CreateLinkDto extends createZodDto(CreateLinkSchema) {}

/** Body of `PATCH /api/links/:id`. `null` clears an optional field. */
export const UpdateLinkSchema = z
  .object({
    url: targetUrl.optional(),
    title: title.nullable().optional(),
    expiresAt: futureDate.nullable().optional(),
    password: password.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

/** DTO for {@link UpdateLinkSchema}. */
export class UpdateLinkDto extends createZodDto(UpdateLinkSchema) {}

/** Query of `GET /api/links`. */
export const ListLinksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional().describe('Search in slug, URL and title'),
});

/** DTO for {@link ListLinksQuerySchema}. */
export class ListLinksQueryDto extends createZodDto(ListLinksQuerySchema) {}

/** `:id` route parameter for links. */
export const LinkIdParamSchema = z.object({ id: z.uuid({ error: 'Link id must be a UUID' }) });

/** DTO for {@link LinkIdParamSchema}. */
export class LinkIdParamDto extends createZodDto(LinkIdParamSchema) {}

/** Query of `GET /api/links/:id/qr`. */
export const QrQuerySchema = z.object({
  size: z.coerce.number().int().min(64).max(2048).default(320).describe('Width/height in pixels'),
  download: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((value) => value === '1' || value === 'true')
    .describe('Send as an attachment'),
});

/** DTO for {@link QrQuerySchema}. */
export class QrQueryDto extends createZodDto(QrQuerySchema) {}

export const LinkViewSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  shortUrl: z.url(),
  targetUrl: z.url(),
  title: z.string().nullable(),
  hasPassword: z.boolean(),
  expiresAt: z.iso.datetime().nullable(),
  isExpired: z.boolean(),
  clickCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** Response shape of a link. */
export class LinkViewDto extends createZodDto(LinkViewSchema) {}

/** Response of `GET /api/links`. */
export class LinkPageDto extends createZodDto(
  z.object({
    items: z.array(LinkViewSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  }),
) {}
