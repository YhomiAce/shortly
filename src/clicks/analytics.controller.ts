import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { LinkIdParamDto } from '../links/dto/link.dto';
import { Analytics, AnalyticsService, OverviewAnalytics } from './analytics.service';
import { AnalyticsDto, AnalyticsQueryDto, OverviewAnalyticsDto } from './dto/analytics.dto';

/** Click analytics endpoints. */
@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('api')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Analytics across all links: totals, clicks per day, top links, referrers, devices, countries' })
  @ApiOkResponse({ type: OverviewAnalyticsDto })
  overview(@Query() query: AnalyticsQueryDto): Promise<OverviewAnalytics> {
    return this.analytics.overview(query.days);
  }

  @Get('links/:id/analytics')
  @ApiOperation({ summary: 'Analytics for one link: totals, clicks per day, referrers, devices, countries' })
  @ApiOkResponse({ type: AnalyticsDto })
  forLink(@Param() params: LinkIdParamDto, @Query() query: AnalyticsQueryDto): Promise<Analytics> {
    return this.analytics.forLink(params.id, query.days);
  }
}
