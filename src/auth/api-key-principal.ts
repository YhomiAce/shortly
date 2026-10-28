import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** The caller identified by an API key. `id` is `"admin"` for the env bootstrap key. */
export interface ApiKeyPrincipal {
  id: string;
  name: string;
}

/** Express request carrying the authenticated principal. */
export interface AuthenticatedRequest extends Request {
  apiKey?: ApiKeyPrincipal;
}

/** Parameter decorator returning the authenticated {@link ApiKeyPrincipal}. */
export const CurrentApiKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): ApiKeyPrincipal | undefined => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().apiKey;
});
