import { StatusCodes } from '@azure/cosmos';
import { isCosmosPreconditionFailedError } from './cosmos-error.utils';

describe('isCosmosPreconditionFailedError', () => {
  it('detects numeric 412', () => {
    expect(isCosmosPreconditionFailedError({ code: 412 })).toBe(true);
  });

  it('detects StatusCodes.PreconditionFailed', () => {
    expect(
      isCosmosPreconditionFailedError({ code: StatusCodes.PreconditionFailed }),
    ).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isCosmosPreconditionFailedError({ code: 404 })).toBe(false);
    expect(isCosmosPreconditionFailedError(new Error('fail'))).toBe(false);
  });
});
