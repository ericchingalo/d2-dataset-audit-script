export interface RevertOptions {
  parentOrgUnit?: string;
  dataSet?: string;
  periods?: string[];
  baseUrl?: string;
  username?: string;
  password?: string;
  patToken?: string;
}

export interface IRevertService {
  execute(options: RevertOptions): Promise<void>;
}
