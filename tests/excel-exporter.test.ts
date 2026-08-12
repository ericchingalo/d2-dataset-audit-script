import { describe, it, expect } from 'vitest';
import { sanitizeSheetName, generateExcelReport } from '../src/services/excel-exporter.js';
import { MergedAuditRow } from '../src/types/dhis2.js';
import fs from 'fs';
import path from 'path';

describe('sanitizeSheetName', () => {
  it('should trim and sanitize invalid Excel sheet name characters', () => {
    const existing = new Set<string>();
    const sanitized = sanitizeSheetName('District / Region [North] ?', existing);
    expect(sanitized).toBe('District   Region  North');
  });

  it('should truncate names longer than 31 characters', () => {
    const existing = new Set<string>();
    const longName = 'Very Long District Name That Exceeds Thirty One Characters';
    const sanitized = sanitizeSheetName(longName, existing);
    expect(sanitized.length).toBeLessThanOrEqual(31);
    expect(sanitized).toBe('Very Long District Name That Ex');
  });

  it('should handle duplicate names by appending numeric counters', () => {
    const existing = new Set<string>();
    const name1 = sanitizeSheetName('Afmadow District', existing);
    const name2 = sanitizeSheetName('Afmadow District', existing);
    expect(name1).toBe('Afmadow District');
    expect(name2).toBe('Afmadow District (1)');
  });
});

describe('generateExcelReport', () => {
  it('should generate an .xlsx file with district sheets', async () => {
    const testOutputPath = path.join(__dirname, 'test_output.xlsx');

    const mockRow: MergedAuditRow = {
      dataElementId: 'QHszJHrLFgx',
      dataElementName: 'Malaria Cases',
      categoryOptionComboId: 'HllvX50cXC0',
      disaggregationName: '< 5 Years',
      period: '2026',
      orgUnitId: 'QuGXmXjGx2o',
      orgUnitName: 'Afmadow District',
      currentValue: '200',
      modifiedBy: 'admin',
      lastUpdated: '2026-06-01T10:00:00.000',
      history: [
        {
          value: '150',
          editedBy: 'abdurahmanSiad',
          created: '2026-05-31T18:51:33.123',
        },
      ],
    };

    const districtMap = new Map<string, MergedAuditRow[]>();
    districtMap.set('Afmadow District', [mockRow]);

    await generateExcelReport(districtMap, testOutputPath);

    expect(fs.existsSync(testOutputPath)).toBe(true);

    // Clean up test file
    if (fs.existsSync(testOutputPath)) {
      fs.unlinkSync(testOutputPath);
    }
  });
});
