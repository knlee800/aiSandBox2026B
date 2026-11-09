import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { CONNECTOR_SESSION_OPENER, openConnectorMcpSession } from './connector-child';
import { ConnectorBroker } from './connector-broker';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { InternalConnectorsController } from './internal-connectors.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ConnectorConnection, AuditEventEntity]), AuthModule],
  controllers: [ConnectorsController, InternalConnectorsController],
  providers: [
    ConnectorsService,
    ConnectorBroker,
    { provide: CONNECTOR_SESSION_OPENER, useValue: openConnectorMcpSession },
  ],
  exports: [ConnectorsService, ConnectorBroker],
})
export class ConnectorsModule {}
