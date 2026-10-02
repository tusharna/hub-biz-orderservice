import { StatusCodes } from '@azure/cosmos';

/** True when Cosmos rejected an If-Match write (document changed since read). */
export function isCosmosPreconditionFailedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const code = (error as { code?: number | string }).code;
  return code === StatusCodes.PreconditionFailed || code === 412;
}
