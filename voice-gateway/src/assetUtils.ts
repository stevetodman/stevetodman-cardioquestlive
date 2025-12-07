import fs from "fs";
import path from "path";

export function assetExists(urlPath: string): boolean {
  const clean = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;
  const abs = path.join(process.cwd(), "public", clean);
  try {
    return fs.existsSync(abs);
  } catch {
    return false;
  }
}
