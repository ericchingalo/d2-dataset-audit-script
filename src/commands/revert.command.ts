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
        "Organisation Unit ID(s) (comma-separated, or parent IDs if --level is specified)",
      )
      .requiredOption("-d, --dataSet <id>", "DHIS2 Dataset ID")
      .requiredOption(
        "-e, --periods <periods>",
        "Comma-separated list of periods (e.g. 2026 or 202601,202602)",
      )
      .option(
        "--level <level>",
        "Organisation Unit Level targeted during audit (optional; if omitted, targets only the parent organisation unit)",
      )
      .option(
        "-o, --output <filename>",
        "Specific output Excel filename to revert from",
      )
      .option(
        "-l, --lastUpdated <date>",
        "Revert only values last updated on or after this date (YYYY-MM-DD)",
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

        if (options.lastUpdated) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(options.lastUpdated)) {
            console.error(
              `Error: Invalid --lastUpdated date format: "${options.lastUpdated}". Expected YYYY-MM-DD.`,
            );
            process.exit(1);
          }
          const parsedDate = new Date(`${options.lastUpdated}T00:00:00Z`);
          if (
            isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== options.lastUpdated
          ) {
            console.error(
              `Error: Invalid --lastUpdated date: "${options.lastUpdated}". Please provide a valid calendar date.`,
            );
            process.exit(1);
          }
        }

        let level: number | undefined;
        if (options.level !== undefined) {
          level = parseInt(options.level, 10);
          if (isNaN(level) || level <= 0) {
            console.error("Error: Organisation unit level must be a valid positive number.");
            process.exit(1);
          }
        }

        await this.revertService.execute({
          parentOrgUnit: options.parentOrgUnit,
          dataSet: options.dataSet,
          periods: periodsList,
          level,
          output: options.output,
          lastUpdated: options.lastUpdated,
          baseUrl,
          username,
          password,
          patToken,
          dryRun: options.dryRun,
        });
      });
  }
}
