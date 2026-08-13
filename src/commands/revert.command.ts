import { Command } from "commander";
import { ICLICommand } from "./command.interface.js";
import { IRevertService } from "../interfaces/revert-service.interface.js";
import { RevertService } from "../services/revert.service.js";

export class RevertCommand implements ICLICommand {
  private revertService: IRevertService;

  constructor(revertService?: IRevertService) {
    this.revertService = revertService || new RevertService();
  }

  register(program: Command): void {
    program
      .command("revert")
      .description("Initiate process to revert dataset values to prior state")
      .requiredOption(
        "-p, --parentOrgUnit <id>",
        "Parent Organisation Unit ID (fetches level 4 districts under this parent)",
      )
      .requiredOption("-d, --dataSet <id>", "DHIS2 Dataset ID")
      .requiredOption(
        "-e, --periods <periods>",
        "Comma-separated list of periods (e.g. 2026 or 202601,202602)",
      )
      .option(
        "--baseUrl <url>",
        "DHIS2 Base URL (overrides DHIS2_BASE_URL env variable)",
      )
      .option("--dry-run", "Preview values to revert without posting to DHIS2")
      .action(async (options) => {
        const baseUrl = options.baseUrl || process.env.DHIS2_BASE_URL;
        const username = process.env.DHIS2_USERNAME;
        const password = process.env.DHIS2_PASSWORD;
        const patToken = process.env.DHIS2_PAT_TOKEN;

        if (!baseUrl) {
          console.error(
            "Error: DHIS2 Base URL must be specified via --baseUrl option or DHIS2_BASE_URL environment variable.",
          );
          process.exit(1);
        }

        if (!patToken && (!username || !password)) {
          console.error(
            "Error: Credentials required. Set DHIS2_USERNAME & DHIS2_PASSWORD or DHIS2_PAT_TOKEN in .env",
          );
          process.exit(1);
        }

        const periodsList = options.periods
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean);

        if (periodsList.length === 0) {
          console.error("Error: At least one period must be specified.");
          process.exit(1);
        }

        await this.revertService.execute({
          parentOrgUnit: options.parentOrgUnit,
          dataSet: options.dataSet,
          periods: periodsList,
          baseUrl,
          username,
          password,
          patToken,
          dryRun: options.dryRun,
        });
      });
  }
}
