import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StellarConfigService } from './stellar-config.service';
import { TransactionBuilderService } from './transaction-builder.service';
import { StellarService } from './stellar.service';
import { ContractService } from './contract.service';
import { StellarController } from './stellar.controller';
import { StellarInvokeContractGuard } from './guards/stellar-invoke-contract.guard';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DeploymentMetadataService } from './services/deployment-metadata.service';

@Module({
  imports: [ConfigModule, AuditLogModule],
  providers: [
    StellarConfigService,
    TransactionBuilderService,
    StellarService,
    ContractService,
    StellarInvokeContractGuard,
    DeploymentMetadataService,
  ],
  controllers: [StellarController],
  exports: [
    StellarConfigService,
    TransactionBuilderService,
    StellarService,
    ContractService,
    DeploymentMetadataService,
  ],
})
export class StellarModule {}
