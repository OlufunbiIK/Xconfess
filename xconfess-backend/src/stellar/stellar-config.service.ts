// src/stellar/stellar-config.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSDK from '@stellar/stellar-sdk';
import {
  IStellarConfig,
  StellarNetwork,
} from './interfaces/stellar-config.interface';
import { DeploymentMetadataService } from './services/deployment-metadata.service';

@Injectable()
export class StellarConfigService implements OnModuleInit {
  private readonly logger = new Logger(StellarConfigService.name);
  private config: IStellarConfig & {
    maxFeeBudget: number;
    feeBackoffMs: number;
    maxFeeRetries: number;
  };
  private server: StellarSDK.Horizon.Server;

  constructor(
    private configService: ConfigService,
    private deploymentMetadataService: DeploymentMetadataService,
  ) {
    this.initializeConfig();
  }

  onModuleInit(): void {
    this.applyDeploymentMetadataFallback();
  }

  private initializeConfig() {
    // Validate network
    const network = this.configService.get<StellarNetwork>(
      'STELLAR_NETWORK',
      StellarNetwork.TESTNET,
    );
    if (!Object.values(StellarNetwork).includes(network)) {
      throw new Error(`Invalid network: ${network}`);
    }

    // Load fee/backoff policy
    const maxFeeBudget = Number(
      this.configService.get('STELLAR_MAX_FEE_BUDGET') ?? 100,
    );
    const feeBackoffMs = Number(
      this.configService.get('STELLAR_FEE_BACKOFF_MS') ?? 5000,
    );
    const maxFeeRetries = Number(
      this.configService.get('STELLAR_MAX_FEE_RETRIES') ?? 3,
    );

    // Build config
    this.config = {
      network,
      horizonUrl: this.getHorizonUrl(network),
      networkPassphrase: this.getNetworkPassphrase(network),
      sorobanRpcUrl: this.getSorobanRpcUrl(network),
      contractIds: {
        confessionAnchor: this.configService.get(
          'CONFESSION_ANCHOR_CONTRACT_ID',
        ),
        reputationBadges: this.configService.get(
          'REPUTATION_BADGES_CONTRACT_ID',
        ),
        tippingSystem: this.configService.get('TIPPING_SYSTEM_CONTRACT_ID'),
      },
      maxFeeBudget,
      feeBackoffMs,
      maxFeeRetries,
    };

    // Initialize Horizon server
    this.server = new StellarSDK.Horizon.Server(this.config.horizonUrl);

    this.logger.log(`Stellar configured for ${network}`);
    this.logger.log(`Horizon URL: ${this.config.horizonUrl}`);
    this.logger.log(
      `Fee budget: ${maxFeeBudget}, Backoff: ${feeBackoffMs}ms, Max retries: ${maxFeeRetries}`,
    );
  }

  private applyDeploymentMetadataFallback(): void {
    const metadata = this.deploymentMetadataService.getMetadata();
    if (!metadata) {
      this.logger.warn(
        'Deployment metadata not available for fallback contract IDs',
      );
    }

    const fallbackIds = this.deploymentMetadataService.getAllContractIds();
    this.config.contractIds = {
      confessionAnchor:
        this.config.contractIds.confessionAnchor || fallbackIds['confession-anchor'],
      reputationBadges:
        this.config.contractIds.reputationBadges || fallbackIds['reputation-badges'],
      tippingSystem:
        this.config.contractIds.tippingSystem || fallbackIds['anonymous-tipping'],
    };

    const featuresEnabled =
      this.configService.get<string>('STELLAR_FEATURES_ENABLED') === 'true';
    const missingContractIds = Object.entries(this.config.contractIds)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (featuresEnabled && missingContractIds.length > 0) {
      throw new Error(
        `Stellar features are enabled but missing contract IDs: ${missingContractIds.join(
          ', ',
        )}. Provide contract IDs through environment variables or deployment metadata.
        `,
      );
    }
  }

  getConfig() {
    return { ...this.config };
  }

  getServer(): StellarSDK.Horizon.Server {
    return this.server;
  }

  getNetwork(): string {
    return this.config.network === StellarNetwork.MAINNET
      ? StellarSDK.Networks.PUBLIC
      : StellarSDK.Networks.TESTNET;
  }

  private getHorizonUrl(network: StellarNetwork): string {
    return network === StellarNetwork.MAINNET
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';
  }

  private getNetworkPassphrase(network: StellarNetwork): string {
    return network === StellarNetwork.MAINNET
      ? StellarSDK.Networks.PUBLIC
      : StellarSDK.Networks.TESTNET;
  }

  private getSorobanRpcUrl(network: StellarNetwork): string {
    return network === StellarNetwork.MAINNET
      ? 'https://soroban-rpc.stellar.org'
      : 'https://soroban-rpc-testnet.stellar.org';
  }

  isMainnet(): boolean {
    return this.config.network === StellarNetwork.MAINNET;
  }

  getContractId(
    contractName: 'confessionAnchor' | 'reputationBadges' | 'tippingSystem',
  ): string {
    const id = this.config.contractIds[contractName];
    if (!id) {
      throw new Error(`Contract ID for ${contractName} not configured`);
    }
    return id;
  }
}
