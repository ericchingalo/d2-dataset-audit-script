import lodash from 'lodash';
import {
  DataValue,
  DataValueAudit,
  MergedAuditRow,
  HistoryEntry,
  OrganisationUnit,
} from '../types/dhis2.js';

export function extractId(val: string | { id: string } | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.id || '';
}

export function mergeAuditData(
  dataValues: DataValue[],
  audits: DataValueAudit[],
  dataElementNames: Record<string, string>,
  cocNames: Record<string, string>,
  orgUnit: OrganisationUnit
): MergedAuditRow[] {
  // Map current data values by key: dataElement:categoryOptionCombo:attributeOptionCombo:period
  const currentValuesMap = new Map<string, DataValue>();
  for (const dv of dataValues) {
    const aoc = dv.attributeOptionCombo || 'default';
    const key = `${dv.dataElement}:${dv.categoryOptionCombo || 'default'}:${aoc}:${dv.period}`;
    currentValuesMap.set(key, dv);
  }

  // Filter audits for UPDATE audit types only
  const updateAudits = audits.filter((a) => a.auditType === 'UPDATE');

  // Group audits by cell key
  const auditGroups = new Map<string, DataValueAudit[]>();
  for (const audit of updateAudits) {
    const deId = extractId(audit.dataElement);
    const cocId = extractId(audit.categoryOptionCombo) || 'default';
    const aocId = extractId(audit.attributeOptionCombo) || 'default';
    const period = extractId(audit.period);
    const key = `${deId}:${cocId}:${aocId}:${period}`;

    if (!auditGroups.has(key)) {
      auditGroups.set(key, []);
    }
    auditGroups.get(key)!.push(audit);
  }

  const resultRows: MergedAuditRow[] = [];

  // Build merged rows for keys that have update audit records
  for (const [key, cellAudits] of auditGroups.entries()) {
    const [deId, cocId, aocIdFromKey, period] = key.split(':');
    const currentValueObj = currentValuesMap.get(key);

    // Sort audits descending by created date (newest first)
    const sortedAudits = [...cellAudits].sort((a, b) => {
      const timeA = new Date(a.created).getTime() || 0;
      const timeB = new Date(b.created).getTime() || 0;
      return timeB - timeA;
    });

    const deName = dataElementNames[deId] || deId;
    let cocName = cocNames[cocId] || cocId;
    if (cocName === 'default' || cocId === 'default') {
      cocName = 'default';
    }

    const currentValue = currentValueObj ? currentValueObj.value : '';
    const modifiedBy = currentValueObj?.storedBy || sortedAudits[0]?.modifiedBy || '';
    const lastUpdated = currentValueObj?.lastUpdated || sortedAudits[0]?.created || '';

    const history: HistoryEntry[] = sortedAudits.map((audit) => ({
      value: audit.value,
      editedBy: audit.modifiedBy,
      created: audit.created,
    }));

    const aocId =
      currentValueObj?.attributeOptionCombo ||
      extractId(sortedAudits[0]?.attributeOptionCombo) ||
      (aocIdFromKey !== 'default' ? aocIdFromKey : undefined);

    let aocName = (aocId && cocNames[aocId]) ? cocNames[aocId] : (aocId || 'default');
    if (aocName === 'default' || aocId === 'default' || !aocName) {
      aocName = 'default';
    }

    resultRows.push({
      dataElementId: deId,
      dataElementName: deName,
      categoryOptionComboId: cocId,
      disaggregationName: cocName,
      period,
      orgUnitId: orgUnit.id,
      orgUnitName: orgUnit.name,
      currentValue,
      modifiedBy,
      lastUpdated,
      history,
      attributeOptionComboId: aocId,
      attributeOptionComboName: aocName,
    });
  }

  // Sort rows by period (descending), then dataElementName (ascending), then disaggregationName (ascending)
  return lodash.orderBy(
    resultRows,
    ['period', 'dataElementName', 'disaggregationName', 'attributeOptionComboName'],
    ['desc', 'asc', 'asc', 'asc']
  );
}
