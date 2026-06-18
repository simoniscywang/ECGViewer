import path from "path";

export function reportDirectory(): string {
  return path.join(process.cwd(), ".data", "reports");
}
