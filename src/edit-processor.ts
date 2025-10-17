import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import { confirm } from "@inquirer/prompts";
import { Edits } from "./types";
import chalk from "chalk";

function createSeparator(text: string = ""): string {
  const separatorLength = 50;
  const paddedText = text ? ` ${text} ` : "";
  const remainingLength = Math.max(separatorLength - paddedText.length, 0);
  const leftPadding = "=".repeat(Math.floor(remainingLength / 2));
  const rightPadding = "=".repeat(Math.ceil(remainingLength / 2));
  return chalk.yellow(`${leftPadding}${paddedText}${rightPadding}`);
}

class FileManager {
  private files: Map<string, string[]> = new Map();

  loadFile(filePath: string): void {
    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!this.files.has(absolutePath)) {
      try {
        const content = fs.readFileSync(absolutePath, "utf-8").split("\n");
        this.files.set(absolutePath, content);
      } catch (error) {
        if (!fs.existsSync(absolutePath)) {
          this.files.set(absolutePath, []);
        } else {
          console.error(`Error reading file ${filePath}:`, error);
        }
      }
    }
  }

  getFileContent(filePath: string): string[] {
    const absolutePath = path.resolve(process.cwd(), filePath);
    return this.files.get(absolutePath) || [];
  }

  updateFile(filePath: string, newContent: string[]): void {
    const absolutePath = path.resolve(process.cwd(), filePath);
    this.files.set(absolutePath, newContent);
  }

  saveAllFiles(): void {
    for (const [filePath, content] of this.files.entries()) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content.join("\n"));
    }
    console.log("All changes have been saved.");
  }
}

export class EditProcessor {
  private fileManager: FileManager;
  private confirmedEdits: Edits = [];

  constructor() {
    this.fileManager = new FileManager();
  }

  async processEditStream(
    editStream: AsyncGenerator<any, void, undefined>
  ): Promise<void> {
    for await (const editPacket of editStream) {
      if (editPacket.type === "edit") {
        const confirmed = await this.confirmEdit(editPacket.edit);
        if (confirmed) {
          this.confirmedEdits.push(editPacket.edit);
        }
      } else if (editPacket.type === "alledits") {
        console.log("All edits processed.");
        break;
      } else if (editPacket.type === "error") {
        console.error(`Error getting further edits: ${editPacket.error}`);
        break;
      }
    }

    if (this.confirmedEdits.length > 0) {
      const userResponse = await confirm({
        message: "\nDo you want to apply all confirmed edits?",
        default: true,
        transformer: (answer) => (answer ? "👍" : "👎"),
      });

      if (userResponse) {
        await this.applyConfirmedEdits();
      } else {
        console.log("All changes discarded.");
      }
    } else {
      console.log("No edits were confirmed.");
    }
  }

  private async confirmEdit(edit: Edits[number]): Promise<boolean> {
    this.fileManager.loadFile(edit.filename);
    const fileContent = this.fileManager.getFileContent(edit.filename);

    let startLine: number, endLine: number;
    let newContent: string[];

    switch (edit.type.type) {
      case "addition":
        startLine = edit.type.atLine - 1;
        endLine = startLine;
        newContent = edit.code.split("\n");
        break;
      case "replacement":
        startLine = edit.type.fromLineNumber - 1;
        endLine = edit.type.toLineNumber;
        newContent = edit.code.split("\n");
        break;
      default:
        console.error("Unknown edit type");
        return false;
    }

    console.log(createSeparator("Proposed Change"));
    console.log(chalk.cyan(`\n${edit.explain}\n`));
    console.log(createSeparator(`Diff for ${edit.filename}`));
    this.printColoredDiff(fileContent, newContent, startLine, endLine);
    console.log(createSeparator());

    const userResponse = await confirm({
      message: "\nDo you want to confirm this change?",
      default: true,
      transformer: (answer) => (answer ? "👍" : "👎"),
    });

    if (userResponse && edit.newPackages && edit.newPackages.length > 0) {
      await this.confirmNewPackages(edit.newPackages);
    }

    return userResponse;
  }

  private async applyConfirmedEdits(): Promise<void> {
    const sortedEdits = this.sortEdits(this.confirmedEdits);
    const totalLinesChanged = this.calculateTotalLinesChanged(sortedEdits);

    console.log(createSeparator("Applying Confirmed Edits"));

    for (const edit of sortedEdits) {
      this.fileManager.loadFile(edit.filename);
      const fileContent = this.fileManager.getFileContent(edit.filename);

      let startLine: number, endLine: number;
      let newContent: string[];

      switch (edit.type.type) {
        case "addition":
          startLine = edit.type.atLine - 1;
          endLine = startLine;
          newContent = edit.code.split("\n");
          break;
        case "replacement":
          startLine = edit.type.fromLineNumber - 1;
          endLine = edit.type.toLineNumber;
          newContent = edit.code.split("\n");
          break;
      }

      const updatedContent = [
        ...fileContent.slice(0, startLine),
        ...newContent,
        ...fileContent.slice(endLine),
      ];
      this.fileManager.updateFile(edit.filename, updatedContent);
      console.log(chalk.green(`✓ Applied change to ${edit.filename}`));
      if (edit.newPackages && edit.newPackages.length > 0) {
        const shouldInstall = await this.confirmNewPackages(edit.newPackages);
        if (shouldInstall) {
          await this.installNewPackages(edit.newPackages);
        }
      }
    }

    console.log(createSeparator("Summary"));
    console.log(chalk.cyan(`Total lines changed: ${totalLinesChanged}`));
    this.fileManager.saveAllFiles();
    console.log(chalk.green("All changes have been saved."));
    console.log(createSeparator());
  }
  private calculateTotalLinesChanged(edits: Edits): number {
    return edits.reduce((total, edit) => {
      if (edit.type.type === "addition") {
        return total + edit.code.split("\n").length;
      } else if (edit.type.type === "replacement") {
        const oldLines = edit.type.toLineNumber - edit.type.fromLineNumber + 1;
        const newLines = edit.code.split("\n").length;
        return total + Math.abs(newLines - oldLines);
      }
      return total;
    }, 0);
  }

  private sortEdits(edits: Edits): Edits {
    return edits.sort((a, b) => {
      const aLine =
        a.type.type === "addition" ? a.type.atLine : a.type.fromLineNumber;
      const bLine =
        b.type.type === "addition" ? b.type.atLine : b.type.fromLineNumber;
      return bLine - aLine; // Sort in descending order (bottom to top)
    });
  }

  private printColoredDiff(
    oldLines: string[],
    newLines: string[],
    startLine: number,
    endLine: number
  ): void {
    const padding = 3;

    for (
      let i = Math.max(0, startLine - padding);
      i < Math.min(oldLines.length, endLine + padding);
      i++
    ) {
      if (i >= startLine && i < endLine) {
        console.log(chalk.red(`- ${oldLines[i]}`));
      } else if (i >= startLine - padding && i < startLine) {
        console.log(chalk.dim(`  ${oldLines[i]}`));
      }
    }

    for (const newLine of newLines) {
      console.log(chalk.green(`+ ${newLine}`));
    }

    for (
      let i = endLine;
      i < Math.min(oldLines.length, endLine + padding);
      i++
    ) {
      console.log(chalk.dim(`  ${oldLines[i]}`));
    }
  }

  private async confirmNewPackages(packages: string[]): Promise<boolean> {
    const userResponse = await confirm({
      message: `This change requires the following new packages: ${packages.join(
        ", "
      )}. Do you want to install them? (Needs bun)`,
      default: true,
      transformer: (answer) => (answer ? "👍" : "👎"),
    });
    if (userResponse) {
      console.log("Packages will be installed when changes are applied.");
    } else {
      console.log("Package installation will be skipped.");
    }
    return userResponse;
  }

  private async installNewPackages(packages: string[]): Promise<void> {
    if (packages.length === 0) return;

    console.log("Installing new packages...");
    try {
      execSync(`bun install ${packages.join(" ")}`, { stdio: "inherit" });
      console.log("Packages installed successfully.");
    } catch (error) {
      console.error("Failed to install packages:", error);
    }
  }
}
