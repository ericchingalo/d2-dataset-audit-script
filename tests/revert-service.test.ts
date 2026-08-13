import { describe, it, expect, vi } from 'vitest';
import { RevertService } from '../src/services/revert.service.js';
import { IDhis2ApiClient } from '../src/interfaces/dhis2-client.interface.js';

describe('RevertService', () => {
  it('logs initiation of revert process and skips if missing required options', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const service = new RevertService();
    const result = await service.execute({
      parentOrgUnit: 'ou1',
      dataSet: 'ds1',
      periods: ['2026'],
      // missing baseUrl
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Revert] Process initiated')
    );
    expect(result.status).toBe('SKIPPED');

    consoleSpy.mockRestore();
  });

  it('fetches audit history and posts reverted data values to DHIS2', async () => {
    const mockPostDataValueSets = vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      importCount: { imported: 0, updated: 1, ignored: 0, deleted: 0 },
    });

    const mockClient: IDhis2ApiClient = {
      getDistricts: vi.fn().mockResolvedValue([{ id: 'dist1', name: 'District 1' }]),
      getDataSetMeta: vi.fn().mockResolvedValue({
        id: 'ds1',
        name: 'Dataset 1',
        dataSetElements: [{ dataElement: { id: 'de1', name: 'Data Element 1' } }],
      }),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({ default: 'default' }),
      getDataValueSets: vi.fn().mockResolvedValue({
        dataValues: [
          {
            dataElement: 'de1',
            period: '202601',
            orgUnit: 'dist1',
            categoryOptionCombo: 'default',
            attributeOptionCombo: 'default',
            value: '50',
          },
        ],
      }),
      getDataValueAudits: vi.fn().mockResolvedValue([
        {
          auditType: 'UPDATE',
          created: '2026-08-01T10:00:00.000',
          modifiedBy: 'john',
          dataElement: 'de1',
          period: '202601',
          organisationUnit: 'dist1',
          categoryOptionCombo: 'default',
          attributeOptionCombo: 'default',
          value: '40', // previous latest value to revert to
        },
      ]),
      postDataValueSets: mockPostDataValueSets,
    };

    const clientFactory = () => mockClient;
    const service = new RevertService(clientFactory);

    const result = await service.execute({
      baseUrl: 'https://dhis2.example.org',
      parentOrgUnit: 'parent1',
      dataSet: 'ds1',
      periods: ['202601'],
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.totalReverted).toBe(1);
    expect(mockPostDataValueSets).toHaveBeenCalledWith({
      dataSet: 'ds1',
      dataValues: [
        expect.objectContaining({
          dataElement: 'de1',
          period: '202601',
          orgUnit: 'dist1',
          value: '40',
        }),
      ],
    });
  });

  it('prepares reverted values in dry-run mode without calling post API', async () => {
    const mockPostDataValueSets = vi.fn();

    const mockClient: IDhis2ApiClient = {
      getDistricts: vi.fn().mockResolvedValue([{ id: 'dist1', name: 'District 1' }]),
      getDataSetMeta: vi.fn().mockResolvedValue({ dataSetElements: [] }),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({}),
      getDataValueSets: vi.fn().mockResolvedValue({
        dataValues: [
          {
            dataElement: 'de1',
            period: '202601',
            orgUnit: 'dist1',
            categoryOptionCombo: 'default',
            attributeOptionCombo: 'default',
            value: '100',
          },
        ],
      }),
      getDataValueAudits: vi.fn().mockResolvedValue([
        {
          auditType: 'UPDATE',
          created: '2026-08-01T10:00:00.000',
          modifiedBy: 'alice',
          dataElement: 'de1',
          period: '202601',
          organisationUnit: 'dist1',
          categoryOptionCombo: 'default',
          attributeOptionCombo: 'default',
          value: '80',
        },
      ]),
      postDataValueSets: mockPostDataValueSets,
    };

    const service = new RevertService(() => mockClient);

    const result = await service.execute({
      baseUrl: 'https://dhis2.example.org',
      parentOrgUnit: 'parent1',
      dataSet: 'ds1',
      periods: ['202601'],
      dryRun: true,
    });

    expect(result.status).toBe('DRY_RUN');
    expect(result.totalReverted).toBe(1);
    expect(mockPostDataValueSets).not.toHaveBeenCalled();
  });

  it('pages data values in chunks of 100 when posting to DHIS2', async () => {
    const mockPostDataValueSets = vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      importCount: { imported: 0, updated: 75, ignored: 0, deleted: 0 },
    });

    const dataValues = Array.from({ length: 150 }, (_, i) => ({
      dataElement: `de_${i}`,
      period: '202601',
      orgUnit: 'dist1',
      categoryOptionCombo: 'default',
      attributeOptionCombo: 'default',
      value: '100',
    }));

    const audits = Array.from({ length: 150 }, (_, i) => ({
      auditType: 'UPDATE' as const,
      created: '2026-08-01T10:00:00.000',
      modifiedBy: 'user1',
      dataElement: `de_${i}`,
      period: '202601',
      organisationUnit: 'dist1',
      categoryOptionCombo: 'default',
      attributeOptionCombo: 'default',
      value: '90',
    }));

    const mockClient: IDhis2ApiClient = {
      getDistricts: vi.fn().mockResolvedValue([{ id: 'dist1', name: 'District 1' }]),
      getDataSetMeta: vi.fn().mockResolvedValue({ dataSetElements: [] }),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({}),
      getDataValueSets: vi.fn().mockResolvedValue({ dataValues }),
      getDataValueAudits: vi.fn().mockResolvedValue(audits),
      postDataValueSets: mockPostDataValueSets,
    };

    const service = new RevertService(() => mockClient);
    const result = await service.execute({
      baseUrl: 'https://dhis2.example.org',
      parentOrgUnit: 'parent1',
      dataSet: 'ds1',
      periods: ['202601'],
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.totalReverted).toBe(150);
    expect(mockPostDataValueSets).toHaveBeenCalledTimes(2);
    expect(mockPostDataValueSets.mock.calls[0][0].dataValues.length).toBe(100);
    expect(mockPostDataValueSets.mock.calls[1][0].dataValues.length).toBe(50);
    expect(result.importSummary?.importCount?.updated).toBe(150);
  });
});
