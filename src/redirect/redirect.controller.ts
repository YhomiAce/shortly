import { Body, Controller, Get, Head, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ClickRecorderService } from '../clicks/click-recorder.service';
import { countryFromHeaders, parseUserAgent, referrerHost } from '../clicks/visitor-info';
import { RateLimiterService } from '../common/rate-limiter.service';
import { escapeHtml, renderPage } from '../common/html';
import { RedirectTarget } from '../links/link-cache.service';
import { LinksService } from '../links/links.service';
import { verifyPassword } from '../links/password';
import { SLUG_PATTERN } from '../links/slug';

const PASSWORD_ATTEMPTS_PER_MINUTE = 10;

/** Public redirect routes: `GET /:slug` and the password form for protected links. */
@ApiExcludeController()
@Controller()
export class RedirectController {
  constructor(
    private readonly links: LinksService,
    private readonly clicks: ClickRecorderService,
    private readonly limiter: RateLimiterService,
  ) {}

  @Head(':slug')
  async head(@Param('slug') slug: string, @Res() res: Response): Promise<void> {
    const target = await this.lookup(slug);
    const status = this.unavailableStatus(target);
    if (status) {
      res.status(status).end();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    if (target?.passwordHash) res.status(200).end();
    else res.redirect(HttpStatus.FOUND, target!.targetUrl);
  }

  @Get(':slug')
  async redirect(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const target = await this.lookup(slug);
    if (this.sendUnavailable(target, res)) return;
    const link = target as RedirectTarget;
    if (link.passwordHash) {
      this.sendPasswordForm(res, slug, HttpStatus.OK);
      return;
    }
    await this.recordClick(link, req);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(HttpStatus.FOUND, link.targetUrl);
  }

  @Post(':slug')
  async unlock(
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown> | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const target = await this.lookup(slug);
    if (this.sendUnavailable(target, res)) return;
    const link = target as RedirectTarget;
    if (!link.passwordHash) {
      res.redirect(HttpStatus.SEE_OTHER, `/${slug}`);
      return;
    }
    const limit = await this.limiter.hit(`unlock:${slug}:${req.ip ?? 'unknown'}`, PASSWORD_ATTEMPTS_PER_MINUTE, 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.resetInSeconds));
      this.sendPasswordForm(res, slug, HttpStatus.TOO_MANY_REQUESTS, 'Too many attempts. Try again in a minute.');
      return;
    }
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || !(await verifyPassword(password, link.passwordHash))) {
      this.sendPasswordForm(res, slug, HttpStatus.UNAUTHORIZED, 'Wrong password.');
      return;
    }
    await this.recordClick(link, req);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(HttpStatus.SEE_OTHER, link.targetUrl);
  }

  private async lookup(slug: string): Promise<RedirectTarget | null> {
    if (!SLUG_PATTERN.test(slug)) return null;
    return this.links.resolve(slug);
  }

  private unavailableStatus(target: RedirectTarget | null): number | null {
    if (!target) return HttpStatus.NOT_FOUND;
    if (target.expiresAt && new Date(target.expiresAt).getTime() <= Date.now()) return HttpStatus.GONE;
    return null;
  }

  /** Sends a 404/410 page if the link can't be used. Returns true if a response was sent. */
  private sendUnavailable(target: RedirectTarget | null, res: Response): boolean {
    const status = this.unavailableStatus(target);
    if (status === null) return false;
    res.setHeader('Cache-Control', 'no-store');
    if (status === HttpStatus.GONE) {
      res.status(status).type('html').send(renderPage('Link expired', '<h1>This link has expired</h1><p>The short link you followed is no longer active.</p>'));
    } else {
      res.status(status).type('html').send(renderPage('Link not found', '<h1>Link not found</h1><p>There is no short link at this address.</p>'));
    }
    return true;
  }

  private sendPasswordForm(res: Response, slug: string, status: number, error?: string): void {
    const action = `/${encodeURIComponent(slug)}`;
    const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : '';
    const body = `<h1>Password required</h1><p>This link is protected. Enter the password to continue.</p>${errorHtml}
<form method="post" action="${escapeHtml(action)}">
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
<button type="submit">Continue</button>
</form>`;
    res.status(status).setHeader('Cache-Control', 'no-store');
    res.type('html').send(renderPage('Password required', body));
  }

  private async recordClick(link: RedirectTarget, req: Request): Promise<void> {
    const client = parseUserAgent(req.headers['user-agent']);
    await this.clicks.record({
      linkId: link.id,
      clickedAt: new Date().toISOString(),
      referrerHost: referrerHost(req.headers.referer),
      ...client,
      country: countryFromHeaders(req.headers),
    });
  }
}
