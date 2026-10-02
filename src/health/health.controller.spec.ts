import { Test, TestingModule } from '@nestjs/testing';
import { CosmosService } from '../cosmos/cosmos.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: CosmosService,
          useValue: {
            checkHealth: jest.fn().mockResolvedValue({ status: 'up' }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns ok when Cosmos is up', async () => {
    await expect(controller.getHealth()).resolves.toEqual({
      status: 'ok',
      checks: { cosmos: { status: 'up' } },
    });
  });
});
