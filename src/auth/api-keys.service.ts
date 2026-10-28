import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyPrincipal } from './api-key-principal';
import { apiKeysEqual, generateApiKey, hashApiKey } from './api-key.util';

/** Public view of a stored API key (never includes the hash). */
export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

const ADMIN_PRINCIPAL: ApiKeyPrincipal = { id: 'admin', name: 'Bootstrap admin key (ADMIN_API_KEY)' };
const LAST_USED_RESOLUTION_MS = 60_000;

/** Creates, lists, revokes and verifies API keys. */
@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Resolves a presented key to a principal, or `null` if it is unknown or revoked. */
  async verify(presented: string): Promise<ApiKeyPrincipal | null> {
    if (apiKeysEqual(presented, this.config.adminApiKey)) return ADMIN_PRINCIPAL;
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(presented) } });
    if (!key || key.revokedAt) return null;
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
      void this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }
    return { id: key.id, name: key.name };
  }

  /** Creates a key and returns it with its plaintext value (shown once). */
  async create(name: string): Promise<ApiKeyView & { key: string }> {
    const generated = generateApiKey();
    const record = await this.prisma.apiKey.create({
      data: { name, prefix: generated.prefix, keyHash: generated.hash },
    });
    return { ...this.toView(record), key: generated.plaintext };
  }

  /** Lists all stored keys, newest first. */
  async list(): Promise<ApiKeyView[]> {
    const keys = await this.prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
    return keys.map((key) => this.toView(key));
  }

  /** Revokes a key. Revoking an already revoked key is a no-op. */
  async revoke(id: string): Promise<ApiKeyView> {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('API key not found');
    if (key.revokedAt) return this.toView(key);
    const updated = await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return this.toView(updated);
  }

  private toView(key: ApiKeyView & { keyHash?: string }): ApiKeyView {
    return {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
    };
  }
}
