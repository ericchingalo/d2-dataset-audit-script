import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { AuditService } from '../src/services/audit.service.js';
import { IDhis2ApiClient } from '../src/interfaces/dhis2-client.interface.js';
import { IReportExporter } from '../src/interfaces/report-exporter.interface.js';
import { OrganisationUnit, DataSetMeta, MergedAuditRow } from '../src/types/dhis2.js';

describe('AuditService', () => {
  it('executes audit pipeline using injected mock client and exporter', async () => {
    const mockOrgUnit: OrganisationUnit = { id: 'ou1', name: 'District 1' };
    const mockDataSetMeta: DataSetMeta = {
      id: 'ds1',
      name: 'Dataset 1',
      dataSetElements: [
        { dataElement: { id: 'de1', name: 'Malaria Cases' } },
      ],
    };

    const mockClient: IDhis2ApiClient = {
      getOrgUnitById: vi.fn().mockResolvedValue(mockOrgUnit),
      validateOrgUnitLevel: vi.fn().mockResolvedValue(true),
      getOrgUnitsByLevel: vi.fn().mockResolvedValue([mockOrgUnit]),
      getDataSetMeta: vi.fn().mockResolvedValue(mockDataSetMeta),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({ coc1: '< 5 Years' }),
      getDataValueAudits: vi.fn().mockResolvedValue([
        {
          created: '2026-05-31T18:51:33.123',
          modifiedBy: 'user1',
          auditType: 'UPDATE',
          value: '100',
          period: '2026',
          organisationUnit: 'ou1',
          attributeOptionCombo: 'coc1',
          categoryOptionCombo: 'coc1',
          dataElement: 'de1',
        },
      ]),
      getDataValueSets: vi.fn().mockResolvedValue({
        dataValues: [
          {
            dataElement: 'de1',
            period: '2026',
            orgUnit: 'ou1',
            categoryOptionCombo: 'coc1',
            attributeOptionCombo: 'coc1',
            value: '200',
          },
        ],
      }),
    };

    const exportedMaps: Map<string, MergedAuditRow[]>[] = [];
    const mockExporter: IReportExporter = {
      exportReport: vi.fn().mockImplementation(async (dataMap) => {
        exportedMaps.push(dataMap);
      }),
    };

    const auditService = new AuditService(() => mockClient, mockExporter);

    const result = await auditService.execute({
      parentOrgUnit: 'parent1',
      dataSet: 'ds1',
      periods: ['2026'],
      level: 4,
      output: 'test_report.xlsx',
      baseUrl: 'https://dhis2.example.org',
    });

    expect(result.districtCount).toBe(1);
    expect(result.totalAuditRows).toBe(1);
    expect(result.outputPath).toBe(path.join('output', 'parent1_2026_test_report.xlsx'));
    expect(mockClient.validateOrgUnitLevel).toHaveBeenCalledWith(4);
    expect(mockClient.getOrgUnitsByLevel).toHaveBeenCalledWith('parent1', 4);
    expect(mockExporter.exportReport).toHaveBeenCalledOnce();
    expect(exportedMaps[0].has('District 1')).toBe(true);
  });

  it('throws error when organisation unit level is invalid in DHIS2', async () => {
    const mockClient: IDhis2ApiClient = {
      getOrgUnitById: vi.fn(),
      validateOrgUnitLevel: vi.fn().mockResolvedValue(false),
      getOrgUnitsByLevel: vi.fn(),
      getDataSetMeta: vi.fn(),
      getCategoryOptionCombos: vi.fn(),
      getDataValueAudits: vi.fn(),
      getDataValueSets: vi.fn(),
    };

    const auditService = new AuditService(() => mockClient);

    await expect(
      auditService.execute({
        parentOrgUnit: 'parent1',
        dataSet: 'ds1',
        periods: ['2026'],
        level: 99,
        output: 'test_report.xlsx',
        baseUrl: 'https://dhis2.example.org',
      })
    ).rejects.toThrow('Organisation unit level 99 does not exist in DHIS2');
  });

  it('uses parent organisation unit directly when level is not passed', async () => {
    const mockParentOrgUnit: OrganisationUnit = { id: 'parent1', name: 'National Ministry' };
    const mockDataSetMeta: DataSetMeta = {
      id: 'ds1',
      name: 'Dataset 1',
      dataSetElements: [
        { dataElement: { id: 'de1', name: 'Malaria Cases' } },
      ],
    };

    const mockClient: IDhis2ApiClient = {
      getOrgUnitById: vi.fn().mockResolvedValue(mockParentOrgUnit),
      validateOrgUnitLevel: vi.fn(),
      getOrgUnitsByLevel: vi.fn(),
      getDataSetMeta: vi.fn().mockResolvedValue(mockDataSetMeta),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({ coc1: '< 5 Years' }),
      getDataValueAudits: vi.fn().mockResolvedValue([
        {
          created: '2026-05-31T18:51:33.123',
          modifiedBy: 'user1',
          auditType: 'UPDATE',
          value: '100',
          period: '2026',
          organisationUnit: 'parent1',
          attributeOptionCombo: 'coc1',
          categoryOptionCombo: 'coc1',
          dataElement: 'de1',
        },
      ]),
      getDataValueSets: vi.fn().mockResolvedValue({
        dataValues: [
          {
            dataElement: 'de1',
            period: '2026',
            orgUnit: 'parent1',
            categoryOptionCombo: 'coc1',
            attributeOptionCombo: 'coc1',
            value: '200',
          },
        ],
      }),
    };

    const exportedMaps: Map<string, MergedAuditRow[]>[] = [];
    const mockExporter: IReportExporter = {
      exportReport: vi.fn().mockImplementation(async (dataMap) => {
        exportedMaps.push(dataMap);
      }),
    };

    const auditService = new AuditService(() => mockClient, mockExporter);

    const result = await auditService.execute({
      parentOrgUnit: 'parent1',
      dataSet: 'ds1',
      periods: ['2026'],
      output: 'test_report.xlsx',
      baseUrl: 'https://dhis2.example.org',
    });

    expect(result.districtCount).toBe(1);
    expect(mockClient.validateOrgUnitLevel).not.toHaveBeenCalled();
    expect(mockClient.getOrgUnitsByLevel).not.toHaveBeenCalled();
    expect(mockClient.getOrgUnitById).toHaveBeenCalledWith('parent1');
    expect(mockExporter.exportReport).toHaveBeenCalledOnce();
    expect(exportedMaps[0].has('National Ministry')).toBe(true);
  });

  it('supports comma-separated parent organisation units when level is omitted', async () => {
    const ouMap: Record<string, OrganisationUnit> = {
      p1: { id: 'p1', name: 'Ministry 1' },
      p2: { id: 'p2', name: 'Ministry 2' },
    };

    const mockClient: IDhis2ApiClient = {
      getOrgUnitById: vi.fn().mockImplementation(async (id: string) => ouMap[id]),
      validateOrgUnitLevel: vi.fn(),
      getOrgUnitsByLevel: vi.fn(),
      getDataSetMeta: vi.fn().mockResolvedValue({ dataSetElements: [] }),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({}),
      getDataValueAudits: vi.fn().mockResolvedValue([]),
      getDataValueSets: vi.fn().mockResolvedValue({ dataValues: [] }),
    };

    const mockExporter: IReportExporter = {
      exportReport: vi.fn().mockResolvedValue(undefined),
    };

    const auditService = new AuditService(() => mockClient, mockExporter);

    const result = await auditService.execute({
      parentOrgUnit: 'p1, p2',
      dataSet: 'ds1',
      periods: ['2026'],
      output: 'test_report.xlsx',
      baseUrl: 'https://dhis2.example.org',
    });

    expect(mockClient.getOrgUnitById).toHaveBeenCalledWith('p1');
    expect(mockClient.getOrgUnitById).toHaveBeenCalledWith('p2');
    expect(result.outputPath).toBe(path.join('output', 'p1_p2_2026_test_report.xlsx'));
    expect(mockExporter.exportReport).toHaveBeenCalledOnce();
  });

  it('supports comma-separated parent organisation units with level and deduplicates children', async () => {
    const mockClient: IDhis2ApiClient = {
      getOrgUnitById: vi.fn(),
      validateOrgUnitLevel: vi.fn().mockResolvedValue(true),
      getOrgUnitsByLevel: vi.fn().mockImplementation(async (parentId: string) => {
        if (parentId === 'p1') {
          return [
            { id: 'c1', name: 'Child 1' },
            { id: 'c2', name: 'Child 2' },
          ];
        }
        return [
          { id: 'c2', name: 'Child 2' }, // duplicate child
          { id: 'c3', name: 'Child 3' },
        ];
      }),
      getDataSetMeta: vi.fn().mockResolvedValue({ dataSetElements: [] }),
      getCategoryOptionCombos: vi.fn().mockResolvedValue({}),
      getDataValueAudits: vi.fn().mockResolvedValue([]),
      getDataValueSets: vi.fn().mockResolvedValue({ dataValues: [] }),
    };

    const mockExporter: IReportExporter = {
      exportReport: vi.fn().mockResolvedValue(undefined),
    };

    const auditService = new AuditService(() => mockClient, mockExporter);

    const result = await auditService.execute({
      parentOrgUnit: 'p1,p2',
      dataSet: 'ds1',
      periods: ['2026'],
      level: 4,
      output: 'test_report.xlsx',
      baseUrl: 'https://dhis2.example.org',
    });

    expect(mockClient.getOrgUnitsByLevel).toHaveBeenCalledWith('p1', 4);
    expect(mockClient.getOrgUnitsByLevel).toHaveBeenCalledWith('p2', 4);
    expect(result.outputPath).toBe(path.join('output', 'p1_p2_2026_test_report.xlsx'));
  });

  it('throws error when parentOrgUnit is empty', async () => {
    const mockClient: IDhis2ApiClient = {
      getOrgUnitById: vi.fn(),
      validateOrgUnitLevel: vi.fn(),
      getOrgUnitsByLevel: vi.fn(),
      getDataSetMeta: vi.fn(),
      getCategoryOptionCombos: vi.fn(),
      getDataValueAudits: vi.fn(),
      getDataValueSets: vi.fn(),
    };

    const auditService = new AuditService(() => mockClient);

    await expect(
      auditService.execute({
        parentOrgUnit: '  ,  ',
        dataSet: 'ds1',
        periods: ['2026'],
        output: 'test_report.xlsx',
        baseUrl: 'https://dhis2.example.org',
      })
    ).rejects.toThrow('At least one parent organisation unit ID must be specified');
  });
});
