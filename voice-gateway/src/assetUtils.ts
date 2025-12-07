import * as fs from "fs";
import * as path from "path";

export function assetExists(urlPath: string | undefined): boolean {
  if (!urlPath || typeof urlPath !== "string") return false;
  const clean = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;
  const abs = path.join(process.cwd(), "public", clean);
  try {
    return fs.existsSync(abs);
  } catch {
    return false;
  }
}
