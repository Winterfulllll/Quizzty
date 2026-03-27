import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: 'Проверка работоспособности API' })
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
