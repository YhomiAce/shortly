import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedRequest } from './api-key-principal';
import { parseBearer } from './api-key.util';
import { ApiKeysService } from './api-keys.service';

/** Requires a valid `Authorization: Bearer <api key>` header. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = parseBearer(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing API key: send "Authorization: Bearer <key>"');
    const principal = await this.apiKeys.verify(token);
    if (!principal) throw new UnauthorizedException('Invalid or revoked API key');
    request.apiKey = principal;
    return true;
  }
}
