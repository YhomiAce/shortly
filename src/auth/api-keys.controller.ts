import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService, ApiKeyView } from './api-keys.service';
import { ApiKeyIdParamDto, ApiKeyViewDto, CreateApiKeyDto, CreatedApiKeyDto } from './dto/api-key.dto';

/** Management of API keys for the management API. */
@ApiTags('API keys')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('api/keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List API keys' })
  @ApiOkResponse({ type: [ApiKeyViewDto] })
  list(): Promise<ApiKeyView[]> {
    return this.apiKeys.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create an API key', description: 'The plaintext key is returned only in this response.' })
  @ApiCreatedResponse({ type: CreatedApiKeyDto })
  create(@Body() body: CreateApiKeyDto): Promise<ApiKeyView & { key: string }> {
    return this.apiKeys.create(body.name);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiOkResponse({ type: ApiKeyViewDto })
  revoke(@Param() params: ApiKeyIdParamDto): Promise<ApiKeyView> {
    return this.apiKeys.revoke(params.id);
  }
}
