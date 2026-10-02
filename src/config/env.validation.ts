const NODE_ENV_VALUES = ['development', 'production', 'test'] as const;

export type NodeEnv = (typeof NODE_ENV_VALUES)[number];

export interface ValidatedEnvironment {
  NODE_ENV: NodeEnv;
  PORT: number;
  COSMOS_ENDPOINT: string;
  COSMOS_KEY: string;
  COSMOS_DATABASE: string;
  COSMOS_ORDERS_CONTAINER: string;
  SERVICE_BUS_NAMESPACE: string;
  SERVICE_BUS_CONNECTION_STRING: string;
  SERVICE_BUS_ORDERS_QUEUE: string;
  SERVICE_BUS_CONSUMER_ENABLED?: string;
}

function readRequiredString(
  config: Record<string, unknown>,
  key: keyof ValidatedEnvironment,
): string {
  const value = config[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing or empty required environment variable: ${key}.`);
  }
  return value.trim();
}

function parseServiceBusNamespaceFromConnectionString(
  connectionString: string,
): string | undefined {
  const endpointMatch = /Endpoint=sb:\/\/([^/;]+)/i.exec(connectionString);
  return endpointMatch?.[1]?.toLowerCase();
}

/** Validates process.env before the app boots (fail fast on misconfiguration). */
export function validateEnvironment(
  config: Record<string, unknown>,
): ValidatedEnvironment {
  const rawNodeEnv = config.NODE_ENV ?? 'development';
  if (
    typeof rawNodeEnv !== 'string' ||
    !NODE_ENV_VALUES.includes(rawNodeEnv as NodeEnv)
  ) {
    const display =
      typeof rawNodeEnv === 'string' ? rawNodeEnv : JSON.stringify(rawNodeEnv);
    throw new Error(
      `Invalid NODE_ENV "${display}". Expected one of: ${NODE_ENV_VALUES.join(', ')}`,
    );
  }

  const rawPort = config.PORT ?? '3000';
  const portString =
    typeof rawPort === 'string' || typeof rawPort === 'number'
      ? String(rawPort)
      : JSON.stringify(rawPort);
  const port = parseInt(portString, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${portString}". Expected 1–65535.`);
  }

  const cosmosEndpoint = readRequiredString(config, 'COSMOS_ENDPOINT');
  try {
    const url = new URL(cosmosEndpoint);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('invalid protocol');
    }
  } catch {
    throw new Error(
      `Invalid COSMOS_ENDPOINT "${cosmosEndpoint}". Expected an http(s) URL.`,
    );
  }

  const serviceBusNamespace = readRequiredString(
    config,
    'SERVICE_BUS_NAMESPACE',
  );
  const serviceBusConnectionString = readRequiredString(
    config,
    'SERVICE_BUS_CONNECTION_STRING',
  );
  if (!/Endpoint=sb:\/\//i.test(serviceBusConnectionString)) {
    throw new Error(
      'Invalid SERVICE_BUS_CONNECTION_STRING. Expected an Azure Service Bus connection string containing Endpoint=sb://…',
    );
  }
  const namespaceFromConnectionString =
    parseServiceBusNamespaceFromConnectionString(serviceBusConnectionString);
  if (
    namespaceFromConnectionString &&
    namespaceFromConnectionString !== serviceBusNamespace.toLowerCase()
  ) {
    throw new Error(
      `SERVICE_BUS_NAMESPACE "${serviceBusNamespace}" does not match connection string endpoint host "${namespaceFromConnectionString}".`,
    );
  }

  const consumerEnabledRaw = config.SERVICE_BUS_CONSUMER_ENABLED;
  const validated: ValidatedEnvironment = {
    NODE_ENV: rawNodeEnv as NodeEnv,
    PORT: port,
    COSMOS_ENDPOINT: cosmosEndpoint,
    COSMOS_KEY: readRequiredString(config, 'COSMOS_KEY'),
    COSMOS_DATABASE: readRequiredString(config, 'COSMOS_DATABASE'),
    COSMOS_ORDERS_CONTAINER: readRequiredString(
      config,
      'COSMOS_ORDERS_CONTAINER',
    ),
    SERVICE_BUS_NAMESPACE: serviceBusNamespace,
    SERVICE_BUS_CONNECTION_STRING: serviceBusConnectionString,
    SERVICE_BUS_ORDERS_QUEUE: readRequiredString(
      config,
      'SERVICE_BUS_ORDERS_QUEUE',
    ),
  };

  if (
    typeof consumerEnabledRaw === 'string' &&
    consumerEnabledRaw.trim().length > 0
  ) {
    validated.SERVICE_BUS_CONSUMER_ENABLED = consumerEnabledRaw.trim();
  }

  return validated;
}
