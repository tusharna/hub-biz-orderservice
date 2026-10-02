import { Injectable } from '@nestjs/common';
import { CosmosService } from '../cosmos/cosmos.service';

export interface CosmosHealthCheck {
  status: 'up' | 'down';
  message?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  checks: {
    cosmos: CosmosHealthCheck;
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly cosmosService: CosmosService) {}

  async check(): Promise<HealthResponse> {
    const cosmos = await this.cosmosService.checkHealth();
    const status = cosmos.status === 'up' ? 'ok' : 'degraded';
    return {
      status,
      checks: { cosmos },
    };
  }
}
