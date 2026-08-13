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
});
