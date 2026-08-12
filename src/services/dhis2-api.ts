import axios, { AxiosInstance } from 'axios';
import type { IDhis2ApiClient, Dhis2ClientConfig } from '../interfaces/dhis2-client.interface.js';
import {
  OrganisationUnit,
  DataSetMeta,
  CategoryOptionCombo,
  DataValueAudit,
  DataValueSetResponse,
} from '../types/dhis2.js';

export type { Dhis2ClientConfig };

export class Dhis2ApiClient implements IDhis2ApiClient {
  private client: AxiosInstance;

  constructor(config: Dhis2ClientConfig) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (config.patToken) {
      headers['Authorization'] = `ApiToken ${config.patToken}`;
    }

    const auth =
      config.username && config.password
        ? {
            username: config.username,
            password: config.password,
          }
        : undefined;

    this.client = axios.create({
      baseURL: config.baseUrl.replace(/\/+$/, ''),
      headers,
      auth,
    });
  }

  /**
   * Fetch district organisation units (level 4) under a given parent org unit
   */
  async getDistricts(parentOrgUnitId: string): Promise<OrganisationUnit[]> {
    const response = await this.client.get<{ organisationUnits: OrganisationUnit[] }>(
      `api/organisationUnits`,
      {
        params: {
          fields: 'id,name',
          filter: `path:like:${parentOrgUnitId}`,
          level: 4,
          paging: false,
        },
      }
    );
    return response.data?.organisationUnits || [];
  }

  /**
   * Fetch dataset metadata including data elements
   */
  async getDataSetMeta(dataSetId: string): Promise<DataSetMeta> {
    const response = await this.client.get<DataSetMeta>(`api/dataSets/${dataSetId}`, {
      params: {
        fields: 'name,dataSetElements[dataElement[id,name]]',
      },
    });
    return response.data;
  }

  /**
   * Fetch category option combos lookup table
   */
  async getCategoryOptionCombos(): Promise<Record<string, string>> {
    try {
      const response = await this.client.get<{ categoryOptionCombos: CategoryOptionCombo[] }>(
        `api/categoryOptionCombos`,
        {
          params: {
            fields: 'id,name',
            paging: false,
          },
        }
      );
      const map: Record<string, string> = {};
      for (const coc of response.data?.categoryOptionCombos || []) {
        map[coc.id] = coc.name;
      }
      return map;
    } catch {
      return {};
    }
  }

  /**
   * Fetch data value audits for an org unit, period, and dataset
   */
  async getDataValueAudits(
    orgUnitId: string,
    period: string,
    dataSetId: string
  ): Promise<DataValueAudit[]> {
    try {
      const response = await this.client.get<{ dataValueAudits: DataValueAudit[] }>(
        `api/audits/dataValue`,
        {
          params: {
            ou: orgUnitId,
            pe: period,
            ds: dataSetId,
            skipPaging: true,
          },
        }
      );
      return response.data?.dataValueAudits || [];
    } catch (error) {
      console.warn(
        `[Warning] Failed to fetch audits for orgUnit ${orgUnitId}, period ${period}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  /**
   * Fetch current data values for an org unit, period, and dataset
   */
  async getDataValueSets(
    orgUnitId: string,
    period: string,
    dataSetId: string
  ): Promise<DataValueSetResponse> {
    try {
      const response = await this.client.get<DataValueSetResponse>(`api/dataValueSets`, {
        params: {
          orgUnit: orgUnitId,
          period: period,
          dataSet: dataSetId,
        },
      });
      return response.data;
    } catch (error) {
      console.warn(
        `[Warning] Failed to fetch data values for orgUnit ${orgUnitId}, period ${period}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return { dataValues: [] };
    }
  }
}
