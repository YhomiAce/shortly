import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/env';
import { Link, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLinkDto, ListLinksQueryDto, UpdateLinkDto } from './dto/link.dto';
import { LinkCacheService, RedirectTarget } from './link-cache.service';
import { hashPassword } from './password';
import { generateSlug } from './slug';

/** Public representation of a link. */
export interface LinkView {
  id: string;
  slug: string;
  shortUrl: string;
  targetUrl: string;
  title: string | null;
  hasPassword: boolean;
  expiresAt: Date | null;
  isExpired: boolean;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A page of links. */
export interface LinkPage {
  items: LinkView[];
  page: number;
  pageSize: number;
  total: number;
}

type LinkWithCount = Link & { _count: { clicks: number } };

const MAX_SLUG_ATTEMPTS = 5;
const withClickCount = { _count: { select: { clicks: true } } } as const;

/** CRUD for short links, plus slug resolution for redirects. */
@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LinkCacheService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Creates a link with the requested slug, or a generated one. */
  async create(input: CreateLinkDto): Promise<LinkView> {
    const data = {
      targetUrl: input.url,
      title: input.title || null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      passwordHash: input.password ? await hashPassword(input.password) : null,
    };

    if (input.slug) {
      try {
        const link = await this.prisma.link.create({ data: { ...data, slug: input.slug }, include: withClickCount });
        await this.cache.invalidate(link.slug);
        return this.toView(link);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException(`Slug "${input.slug}" is already taken`);
        throw error;
      }
    }

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
      try {
        const link = await this.prisma.link.create({ data: { ...data, slug: generateSlug() }, include: withClickCount });
        await this.cache.invalidate(link.slug);
        return this.toView(link);
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === MAX_SLUG_ATTEMPTS) throw error;
      }
    }
    throw new Error('unreachable');
  }

  /** Lists links, newest first, optionally filtered by a search term. */
  async list(query: ListLinksQueryDto): Promise<LinkPage> {
    const where: Prisma.LinkWhereInput = query.q
      ? {
          OR: [
            { slug: { contains: query.q, mode: 'insensitive' } },
            { targetUrl: { contains: query.q, mode: 'insensitive' } },
            { title: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, links] = await this.prisma.$transaction([
      this.prisma.link.count({ where }),
      this.prisma.link.findMany({
        where,
        include: withClickCount,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: links.map((link) => this.toView(link)), page: query.page, pageSize: query.pageSize, total };
  }

  /** Returns one link or throws 404. */
  async get(id: string): Promise<LinkView> {
    return this.toView(await this.findOrThrow(id));
  }

  /** Updates a link and refreshes its cache entry. */
  async update(id: string, input: UpdateLinkDto): Promise<LinkView> {
    await this.findOrThrow(id);
    const data: Prisma.LinkUpdateInput = {};
    if (input.url !== undefined) data.targetUrl = input.url;
    if (input.title !== undefined) data.title = input.title || null;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (input.password !== undefined) data.passwordHash = input.password ? await hashPassword(input.password) : null;
    const link = await this.prisma.link.update({ where: { id }, data, include: withClickCount });
    await this.cache.invalidate(link.slug);
    return this.toView(link);
  }

  /** Deletes a link and its clicks. */
  async remove(id: string): Promise<void> {
    const link = await this.findOrThrow(id);
    await this.prisma.link.delete({ where: { id } });
    await this.cache.invalidate(link.slug);
  }

  /** Resolves a slug for redirecting, using the Redis cache. Returns `null` if unknown. */
  async resolve(slug: string): Promise<RedirectTarget | null> {
    const cached = await this.cache.get(slug);
    if (cached !== undefined) return cached;
    const link = await this.prisma.link.findUnique({
      where: { slug },
      select: { id: true, targetUrl: true, expiresAt: true, passwordHash: true },
    });
    const target: RedirectTarget | null = link
      ? { ...link, expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null }
      : null;
    await this.cache.set(slug, target);
    return target;
  }

  /** Builds the public short URL for a slug. */
  shortUrl(slug: string): string {
    return `${this.config.publicBaseUrl}/${slug}`;
  }

  private async findOrThrow(id: string): Promise<LinkWithCount> {
    const link = await this.prisma.link.findUnique({ where: { id }, include: withClickCount });
    if (!link) throw new NotFoundException('Link not found');
    return link;
  }

  private toView(link: LinkWithCount): LinkView {
    return {
      id: link.id,
      slug: link.slug,
      shortUrl: this.shortUrl(link.slug),
      targetUrl: link.targetUrl,
      title: link.title,
      hasPassword: link.passwordHash !== null,
      expiresAt: link.expiresAt,
      isExpired: link.expiresAt !== null && link.expiresAt.getTime() <= Date.now(),
      clickCount: link._count.clicks,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
