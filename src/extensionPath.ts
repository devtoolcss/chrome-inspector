import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CHROME_INSPECTOR_SYNC_EXTENSION_PATH = path.join(
  __dirname,
  "extension",
);
