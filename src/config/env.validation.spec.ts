import { validateEnvironment } from './env.validation';

const validCosmos = {
  COSMOS_ENDPOINT: 'https://account.documents.azure.com:443/',
  COSMOS_KEY: 'key',
  COSMOS_DATABASE: 'ecommerce',
  COSMOS_ORDERS_CONTAINER: 'orders',
};

const validServiceBus = {
  SERVICE_BUS_NAMESPACE: 'mybus.servicebus.windows.net',
  SERVICE_BUS_CONNECTION_STRING:
    'Endpoint=sb://mybus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=test',
  SERVICE_BUS_ORDERS_QUEUE: 'orders-queue',
};

describe('validateEnvironment', () => {
  it('accepts defaults when NODE_ENV and PORT are omitted', () => {
    expect(validateEnvironment({ ...validCosmos, ...validServiceBus })).toEqual(
      {
        NODE_ENV: 'development',
        PORT: 3000,
        ...validCosmos,
        ...validServiceBus,
      },
    );
  });

  it('accepts valid NODE_ENV and PORT', () => {
    expect(
      validateEnvironment({
        ...validCosmos,
        ...validServiceBus,
        NODE_ENV: 'production',
        PORT: '8080',
      }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      ...validCosmos,
      ...validServiceBus,
    });
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() =>
      validateEnvironment({
        ...validCosmos,
        ...validServiceBus,
        NODE_ENV: 'staging',
      }),
    ).toThrow(/Invalid NODE_ENV/);
  });

  it('rejects invalid PORT', () => {
    expect(() =>
      validateEnvironment({ ...validCosmos, ...validServiceBus, PORT: '0' }),
    ).toThrow(/Invalid PORT/);
  });

  it('requires Cosmos configuration', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development' })).toThrow(
      /COSMOS_ENDPOINT/,
    );
  });

  it('rejects Service Bus namespace mismatch', () => {
    expect(() =>
      validateEnvironment({
        ...validCosmos,
        ...validServiceBus,
        SERVICE_BUS_NAMESPACE: 'other.servicebus.windows.net',
      }),
    ).toThrow(/does not match connection string endpoint host/);
  });
});
