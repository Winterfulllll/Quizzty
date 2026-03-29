import { Module } from '@nestjs/common';
import { SessionController } from './session.controller.js';
import { SessionService } from './session.service.js';
import { SessionGateway } from './session.gateway.js';

@Module({
  controllers: [SessionController],
  providers: [SessionService, SessionGateway],
})
export class SessionModule {}
