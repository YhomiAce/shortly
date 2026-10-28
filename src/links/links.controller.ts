import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { toBuffer as qrToBuffer } from 'qrcode';
import { ApiKeyGuard } from '../auth/api-key.guard';
import {
  CreateLinkDto,
  LinkIdParamDto,
  LinkPageDto,
  LinkViewDto,
  ListLinksQueryDto,
  QrQueryDto,
  UpdateLinkDto,
} from './dto/link.dto';
import { LinkCreationRateLimitGuard } from './link-creation-rate-limit.guard';
import { LinkPage, LinksService, LinkView } from './links.service';

/** Management API for short links. */
@ApiTags('Links')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('api/links')
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Post()
  @UseGuards(LinkCreationRateLimitGuard)
  @ApiOperation({ summary: 'Create a short link' })
  @ApiCreatedResponse({ type: LinkViewDto })
  @ApiTooManyRequestsResponse({ description: 'Creation rate limit reached' })
  create(@Body() body: CreateLinkDto): Promise<LinkView> {
    return this.links.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'List links' })
  @ApiOkResponse({ type: LinkPageDto })
  list(@Query() query: ListLinksQueryDto): Promise<LinkPage> {
    return this.links.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a link' })
  @ApiOkResponse({ type: LinkViewDto })
  get(@Param() params: LinkIdParamDto): Promise<LinkView> {
    return this.links.get(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a link' })
  @ApiOkResponse({ type: LinkViewDto })
  update(@Param() params: LinkIdParamDto, @Body() body: UpdateLinkDto): Promise<LinkView> {
    return this.links.update(params.id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a link and its click history' })
  @ApiNoContentResponse()
  async remove(@Param() params: LinkIdParamDto): Promise<void> {
    await this.links.remove(params.id);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'QR code (PNG) for the short URL' })
  @ApiProduces('image/png')
  @ApiOkResponse({ description: 'PNG image', schema: { type: 'string', format: 'binary' } })
  async qr(@Param() params: LinkIdParamDto, @Query() query: QrQueryDto, @Res() res: Response): Promise<void> {
    const link = await this.links.get(params.id);
    const png = await qrToBuffer(link.shortUrl, { type: 'png', width: query.size, margin: 2, errorCorrectionLevel: 'M' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (query.download) res.setHeader('Content-Disposition', `attachment; filename="${link.slug}-qr.png"`);
    res.send(png);
  }
}
