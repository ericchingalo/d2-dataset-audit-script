import { describe, it, expect, vi } from 'vitest';
import { RevertService } from '../src/services/revert.service.js';

describe('RevertService', () => {
  it('logs initiation of revert process', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const service = new RevertService();
    await service.execute({
      parentOrgUnit: 'ou1',
      dataSet: 'ds1',
      periods: ['2026'],
      baseUrl: 'https://dhis2.example.org',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Revert] Process initiated')
    );

    consoleSpy.mockRestore();
  });
});
