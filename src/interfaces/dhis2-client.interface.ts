import {
  OrganisationUnit,
  DataSetMeta,
  DataValueAudit,
  DataValueSetResponse,
  DataValue,
  DataValueImportSummary,
} from '../types/dhis2.js';

export interface Dhis2ClientConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  patToken?: string;
}

export interface IDhis2ApiClient {
  getOrgUnitById(id: string): Promise<OrganisationUnit>;
  getOrgUnitsByLevel(parentOrgUnitId: string, level: number): Promise<OrganisationUnit[]>;
  validateOrgUnitLevel(level: number): Promise<boolean>;
  getDataSetMeta(dataSetId: string): Promise<DataSetMeta>;
  getCategoryOptionCombos(): Promise<Record<string, string>>;
  getDataValueAudits(
    orgUnitId: string,
    period: string,
    dataSetId: string
  ): Promise<DataValueAudit[]>;
  getDataValueSets(
    orgUnitId: string,
    period: string,
    dataSetId: string
  ): Promise<DataValueSetResponse>;
  postDataValueSets(dataValueSet: DataValueSetResponse): Promise<DataValueImportSummary>;
  postDataValue?(dataValue: DataValue): Promise<any>;
}
