/** Default Cosmos env for unit/e2e tests (no real Azure connection). */
process.env.COSMOS_ENDPOINT ??= 'https://test-account.documents.azure.com:443/';
process.env.COSMOS_KEY ??= 'test-cosmos-key';
process.env.COSMOS_DATABASE ??= 'ecommerce';
process.env.COSMOS_ORDERS_CONTAINER ??= 'orders';

process.env.SERVICE_BUS_NAMESPACE ??= 'test.servicebus.windows.net';
process.env.SERVICE_BUS_CONNECTION_STRING ??=
  'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=test-key';
process.env.SERVICE_BUS_ORDERS_QUEUE ??= 'orders-queue';
process.env.SERVICE_BUS_CONSUMER_ENABLED ??= 'false';
process.env.OUTBOX_PUBLISHER_ENABLED ??= 'false';
