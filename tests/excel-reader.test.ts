import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { generateExcelReport } from '../src/services/excel-exporter.js';
import { readAuditReportExcel } from '../src/services/excel-reader.js';
import { MergedAuditRow } from '../src/types/dhis2.js';

describe('readAuditReportExcel', () => {
  const testOutputPath = path.join(__dirname, 'test_excel_reader.xlsx');

  afterEach(() => {
    if (fs.existsSync(testOutputPath)) {
      fs.unlinkSync(testOutputPath);
    }
  });

  it('reads audit report Excel with Attribute Option Combo column', async () => {
    const mockRow: MergedAuditRow = {
      dataElementId: 'de1',
      dataElementName: 'Malaria Cases',
      categoryOptionComboId: 'coc1',
      disaggregationName: '< 5 Years',
      attributeOptionComboId: 'aoc1',
      attributeOptionComboName: 'Partner Alpha',
      period: '202601',
      orgUnitId: 'ou1',
      orgUnitName: 'Afmadow District',
      currentValue: '200',
      modifiedBy: 'admin',
      lastUpdated: '2026-06-01T10:00:00.000Z',
      history: [
        {
          value: '150',
          editedBy: 'user1',
          created: '2026-05-31T18:51:33.123Z',
        },
      ],
    };

    const districtMap = new Map<string, MergedAuditRow[]>();
    districtMap.set('Afmadow District', [mockRow]);

    await generateExcelReport(districtMap, testOutputPath);

    const rows = await readAuditReportExcel(testOutputPath);

    expect(rows).toHaveLength(1);
    expect(rows[0].dataElementName).toBe('Malaria Cases');
    expect(rows[0].disaggregationName).toBe('< 5 Years');
    expect(rows[0].attributeOptionCombo).toBe('Partner Alpha');
    expect(rows[0].period).toBe('202601');
    expect(rows[0].currentValue).toBe('200');
    expect(rows[0].previousValue).toBe('150');
    expect(rows[0].orgUnitName).toBe('Afmadow District');
  });

  it('maintains backward compatibility with legacy reports without Attribute Option Combo column', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Afmadow District');

    // Legacy headers without 'Attribute Option Combo'
    sheet.addRow([
      'Data Element',
      'Disaggregation',
      'Period',
      'Current Value',
      'Modified By',
      'Last Updated',
      'Previous Value 1',
      'Edited By (Prev 1)',
      'Date (Prev 1)',
    ]);

    sheet.addRow([
      'TB Cases',
      'default',
      '202602',
      '50',
      'user_legacy',
      '2026-06-01T10:00:00.000Z',
      '30',
      'user_old',
      '2026-05-01T10:00:00.000Z',
    ]);

    await workbook.xlsx.writeFile(testOutputPath);

    const rows = await readAuditReportExcel(testOutputPath);

    expect(rows).toHaveLength(1);
    expect(rows[0].dataElementName).toBe('TB Cases');
    expect(rows[0].disaggregationName).toBe('default');
    expect(rows[0].attributeOptionCombo).toBeUndefined();
    expect(rows[0].period).toBe('202602');
    expect(rows[0].currentValue).toBe('50');
    expect(rows[0].previousValue).toBe('30');
  });
});
