import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { RevertService } from '../src/services/revert.service.js';
import { IDhis2ApiClient } from '../src/interfaces/dhis2-client.interface.js';
import * as excelReader from '../src/services/excel-reader.js';

describe('RevertService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  it('returns NO_FILES if no matching audit report file is found', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([] as any);

    const service = new RevertService();
    const result = await service.execute({
      baseUrl: 'https://dhis2.example.org',
      parentOrgUnit: 'parent1',
      dataSet: 'ds1',
      periods: ['202601'],
    });

    expect(result.status).toBe('NO_FILES');
  });

  it('reads audit report Excel and posts reverted data values to DHIS2', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['parent1_202601_report.xlsx'] as any);
    vi.spyOn(excelReader, 'readAuditReportExcel').mockResolvedValue([
      {
        orgUnitName: 'District 1',
        dataElementName: 'Data Element 1',
        disaggregationName: 'default',
        period: '202601',
        currentValue: '50',
        previousValue: '40',
      },
    ]);

    const mockPostDataValueSets = vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      importCount: { imported: 0, updated: 1, ignored: 0, deleted: 0 },
    });

    const mockClient: IDhis2ApiClient = {
      getOrgUnitsByLevel: vi.fn().mockResolvedValue([{ id: 'dist1', name: 'District 1' }]),
      getDataSetMeta: vi.fn().mockResolvedValue({
        id: 'ds1',
        name: 'Dataset 1',
        dataSetElements: [{ dataElement: { id: 'de1', name: 'Data Element 1' } }],
      }),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({ default: 'default' }),
      getDataValueSets: vi.fn(),
      getDataValueAudits: vi.fn(),
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
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['parent1_202601_report.xlsx'] as any);
    vi.spyOn(excelReader, 'readAuditReportExcel').mockResolvedValue([
      {
        orgUnitName: 'District 1',
        dataElementName: 'Data Element 1',
        disaggregationName: 'default',
        period: '202601',
        currentValue: '100',
        previousValue: '80',
      },
    ]);

    const mockPostDataValueSets = vi.fn();

    const mockClient: IDhis2ApiClient = {
      getOrgUnitsByLevel: vi.fn().mockResolvedValue([{ id: 'dist1', name: 'District 1' }]),
      getDataSetMeta: vi.fn().mockResolvedValue({
        dataSetElements: [{ dataElement: { id: 'de1', name: 'Data Element 1' } }],
      }),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({}),
      getDataValueSets: vi.fn(),
      getDataValueAudits: vi.fn(),
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
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['parent1_202601_report.xlsx'] as any);

    const parsedRows = Array.from({ length: 150 }, (_, i) => ({
      orgUnitName: 'District 1',
      dataElementName: `Data Element ${i}`,
      disaggregationName: 'default',
      period: '202601',
      currentValue: '100',
      previousValue: '90',
    }));

    vi.spyOn(excelReader, 'readAuditReportExcel').mockResolvedValue(parsedRows);

    const mockPostDataValueSets = vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      importCount: { imported: 0, updated: 75, ignored: 0, deleted: 0 },
    });

    const dataSetElements = Array.from({ length: 150 }, (_, i) => ({
      dataElement: { id: `de_${i}`, name: `Data Element ${i}` },
    }));

    const mockClient: IDhis2ApiClient = {
      getOrgUnitsByLevel: vi.fn().mockResolvedValue([{ id: 'dist1', name: 'District 1' }]),
      getDataSetMeta: vi.fn().mockResolvedValue({ dataSetElements }),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({}),
      getDataValueSets: vi.fn(),
      getDataValueAudits: vi.fn(),
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

  it('filters rows by lastUpdated date inclusively and excludes prior or empty dates', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['parent1_202601_report.xlsx'] as any);

    const parsedRows = [
      {
        orgUnitName: 'District 1',
        dataElementName: 'Data Element 1',
        disaggregationName: 'default',
        period: '202601',
        currentValue: '100',
        previousValue: '90',
        lastUpdated: '2026-08-15T08:30:00.000Z', // on date -> included
      },
      {
        orgUnitName: 'District 1',
        dataElementName: 'Data Element 2',
        disaggregationName: 'default',
        period: '202601',
        currentValue: '80',
        previousValue: '70',
        lastUpdated: '2026-08-16T10:00:00.000Z', // after date -> included
      },
      {
        orgUnitName: 'District 1',
        dataElementName: 'Data Element 3',
        disaggregationName: 'default',
        period: '202601',
        currentValue: '50',
        previousValue: '40',
        lastUpdated: '2026-08-14T23:59:59.000Z', // before date -> excluded
      },
      {
        orgUnitName: 'District 1',
        dataElementName: 'Data Element 4',
        disaggregationName: 'default',
        period: '202601',
        currentValue: '20',
        previousValue: '10',
        lastUpdated: '', // missing -> excluded
      },
    ];

    vi.spyOn(excelReader, 'readAuditReportExcel').mockResolvedValue(parsedRows);

    const mockPostDataValueSets = vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      importCount: { imported: 0, updated: 2, ignored: 0, deleted: 0 },
    });

    const mockClient: IDhis2ApiClient = {
      getOrgUnitsByLevel: vi.fn().mockResolvedValue([{ id: 'dist1', name: 'District 1' }]),
      getDataSetMeta: vi.fn().mockResolvedValue({
        dataSetElements: [
          { dataElement: { id: 'de1', name: 'Data Element 1' } },
          { dataElement: { id: 'de2', name: 'Data Element 2' } },
          { dataElement: { id: 'de3', name: 'Data Element 3' } },
          { dataElement: { id: 'de4', name: 'Data Element 4' } },
        ],
      }),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({}),
      getDataValueSets: vi.fn(),
      getDataValueAudits: vi.fn(),
      postDataValueSets: mockPostDataValueSets,
    };

    const service = new RevertService(() => mockClient);
    const result = await service.execute({
      baseUrl: 'https://dhis2.example.org',
      parentOrgUnit: 'parent1',
      dataSet: 'ds1',
      periods: ['202601'],
      lastUpdated: '2026-08-15',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.totalReverted).toBe(2);
    expect(mockPostDataValueSets).toHaveBeenCalledTimes(1);
    expect(mockPostDataValueSets.mock.calls[0][0].dataValues).toEqual([
      expect.objectContaining({ dataElement: 'de1', value: '90' }),
      expect.objectContaining({ dataElement: 'de2', value: '70' }),
    ]);
  });

  it('returns NO_CHANGES if all rows are prior to lastUpdated date', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['parent1_202601_report.xlsx'] as any);

    const parsedRows = [
      {
        orgUnitName: 'District 1',
        dataElementName: 'Data Element 1',
        disaggregationName: 'default',
        period: '202601',
        currentValue: '100',
        previousValue: '90',
        lastUpdated: '2026-08-10T08:30:00.000Z',
      },
    ];

    vi.spyOn(excelReader, 'readAuditReportExcel').mockResolvedValue(parsedRows);

    const mockPostDataValueSets = vi.fn();

    const mockClient: IDhis2ApiClient = {
      getOrgUnitsByLevel: vi.fn().mockResolvedValue([{ id: 'dist1', name: 'District 1' }]),
      getDataSetMeta: vi.fn().mockResolvedValue({
        dataSetElements: [{ dataElement: { id: 'de1', name: 'Data Element 1' } }],
      }),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({}),
      getDataValueSets: vi.fn(),
      getDataValueAudits: vi.fn(),
      postDataValueSets: mockPostDataValueSets,
    };

    const service = new RevertService(() => mockClient);
    const result = await service.execute({
      baseUrl: 'https://dhis2.example.org',
      parentOrgUnit: 'parent1',
      dataSet: 'ds1',
      periods: ['202601'],
      lastUpdated: '2026-08-15',
    });

    expect(result.status).toBe('NO_CHANGES');
    expect(result.totalReverted).toBe(0);
    expect(mockPostDataValueSets).not.toHaveBeenCalled();
  });
});
