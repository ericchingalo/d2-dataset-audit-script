import { describe, it, expect } from 'vitest';
import { mergeAuditData } from '../src/services/audit-merger.js';
import { DataValue, DataValueAudit, OrganisationUnit } from '../src/types/dhis2.js';

describe('mergeAuditData', () => {
  const mockOrgUnit: OrganisationUnit = {
    id: 'QuGXmXjGx2o',
    name: 'Afmadow District',
  };

  const dataElementNames = {
    QHszJHrLFgx: 'Malaria Cases',
    oFCPlJ9wLjh: 'TB Cases',
  };

  const cocNames = {
    HllvX50cXC0: '< 5 Years',
  };

  it('should correctly merge UPDATE audits with current data values', () => {
    const dataValues: DataValue[] = [
      {
        dataElement: 'QHszJHrLFgx',
        period: '2026',
        orgUnit: 'QuGXmXjGx2o',
        categoryOptionCombo: 'HllvX50cXC0',
        attributeOptionCombo: 'HllvX50cXC0',
        value: '200',
        storedBy: 'current_user',
        lastUpdated: '2026-06-01T10:00:00.000',
      },
    ];

    const audits: DataValueAudit[] = [
      {
        created: '2026-05-31T18:51:33.123',
        modifiedBy: 'abdurahmanSiad',
        auditType: 'UPDATE',
        value: '152563',
        period: '2026',
        organisationUnit: 'QuGXmXjGx2o',
        attributeOptionCombo: 'HllvX50cXC0',
        categoryOptionCombo: 'HllvX50cXC0',
        dataElement: 'QHszJHrLFgx',
      },
      {
        created: '2026-05-15T12:00:00.000',
        modifiedBy: 'initial_user',
        auditType: 'UPDATE',
        value: '100',
        period: '2026',
        organisationUnit: 'QuGXmXjGx2o',
        attributeOptionCombo: 'HllvX50cXC0',
        categoryOptionCombo: 'HllvX50cXC0',
        dataElement: 'QHszJHrLFgx',
      },
    ];

    const result = mergeAuditData(
      dataValues,
      audits,
      dataElementNames,
      cocNames,
      mockOrgUnit
    );

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.dataElementName).toBe('Malaria Cases');
    expect(row.disaggregationName).toBe('< 5 Years');
    expect(row.currentValue).toBe('200');
    expect(row.modifiedBy).toBe('current_user');
    expect(row.history).toHaveLength(2);
    expect(row.history[0].value).toBe('152563'); // Newest edit first
    expect(row.history[0].editedBy).toBe('abdurahmanSiad');
    expect(row.history[1].value).toBe('100');
    expect(row.history[1].editedBy).toBe('initial_user');
  });

  it('should ignore data values that have NO UPDATE audit records', () => {
    const dataValues: DataValue[] = [
      {
        dataElement: 'oFCPlJ9wLjh',
        period: '2026',
        orgUnit: 'QuGXmXjGx2o',
        categoryOptionCombo: 'HllvX50cXC0',
        attributeOptionCombo: 'HllvX50cXC0',
        value: '16259',
        storedBy: 'scriptrunner',
        created: '2026-05-05T08:43:45.000',
      },
    ];

    const audits: DataValueAudit[] = []; // No audits

    const result = mergeAuditData(
      dataValues,
      audits,
      dataElementNames,
      cocNames,
      mockOrgUnit
    );

    expect(result).toHaveLength(0);
  });

  it('should sort rows by data element name alphabetically', () => {
    const dataValues: DataValue[] = [
      {
        dataElement: 'QHszJHrLFgx',
        period: '2026',
        orgUnit: 'QuGXmXjGx2o',
        categoryOptionCombo: 'HllvX50cXC0',
        attributeOptionCombo: 'HllvX50cXC0',
        value: '200',
      },
      {
        dataElement: 'oFCPlJ9wLjh',
        period: '2026',
        orgUnit: 'QuGXmXjGx2o',
        categoryOptionCombo: 'HllvX50cXC0',
        attributeOptionCombo: 'HllvX50cXC0',
        value: '500',
      },
    ];

    const audits: DataValueAudit[] = [
      {
        created: '2026-05-31T18:51:33.123',
        modifiedBy: 'user1',
        auditType: 'UPDATE',
        value: '150',
        period: '2026',
        organisationUnit: 'QuGXmXjGx2o',
        attributeOptionCombo: 'HllvX50cXC0',
        categoryOptionCombo: 'HllvX50cXC0',
        dataElement: 'QHszJHrLFgx',
      },
      {
        created: '2026-05-31T18:51:33.123',
        modifiedBy: 'user2',
        auditType: 'UPDATE',
        value: '450',
        period: '2026',
        organisationUnit: 'QuGXmXjGx2o',
        attributeOptionCombo: 'HllvX50cXC0',
        categoryOptionCombo: 'HllvX50cXC0',
        dataElement: 'oFCPlJ9wLjh',
      },
    ];

    const result = mergeAuditData(
      dataValues,
      audits,
      dataElementNames,
      cocNames,
      mockOrgUnit
    );

    expect(result).toHaveLength(2);
    expect(result[0].dataElementName).toBe('Malaria Cases');
    expect(result[1].dataElementName).toBe('TB Cases');
  });

  it('should sort rows by period in descending order', () => {
    const dataValues: DataValue[] = [
      {
        dataElement: 'QHszJHrLFgx',
        period: '2025',
        orgUnit: 'QuGXmXjGx2o',
        categoryOptionCombo: 'HllvX50cXC0',
        attributeOptionCombo: 'HllvX50cXC0',
        value: '100',
      },
      {
        dataElement: 'QHszJHrLFgx',
        period: '2026',
        orgUnit: 'QuGXmXjGx2o',
        categoryOptionCombo: 'HllvX50cXC0',
        attributeOptionCombo: 'HllvX50cXC0',
        value: '200',
      },
    ];

    const audits: DataValueAudit[] = [
      {
        created: '2025-05-31T18:51:33.123',
        modifiedBy: 'user1',
        auditType: 'UPDATE',
        value: '50',
        period: '2025',
        organisationUnit: 'QuGXmXjGx2o',
        attributeOptionCombo: 'HllvX50cXC0',
        categoryOptionCombo: 'HllvX50cXC0',
        dataElement: 'QHszJHrLFgx',
      },
      {
        created: '2026-05-31T18:51:33.123',
        modifiedBy: 'user2',
        auditType: 'UPDATE',
        value: '150',
        period: '2026',
        organisationUnit: 'QuGXmXjGx2o',
        attributeOptionCombo: 'HllvX50cXC0',
        categoryOptionCombo: 'HllvX50cXC0',
        dataElement: 'QHszJHrLFgx',
      },
    ];

    const result = mergeAuditData(
      dataValues,
      audits,
      dataElementNames,
      cocNames,
      mockOrgUnit
    );

    expect(result).toHaveLength(2);
    expect(result[0].period).toBe('2026');
    expect(result[1].period).toBe('2025');
  });
});
