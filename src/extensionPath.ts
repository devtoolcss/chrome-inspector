let CHROME_INSPECTOR_SYNC_EXTENSION_PATH: string | undefined;

const pkgs = typeof window === "undefined" ? ["url", "path"] : [];

if (typeof window === "undefined") {
  const { fileURLToPath } = await import(pkgs[0]);
  const path = await import(pkgs[1]);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  CHROME_INSPECTOR_SYNC_EXTENSION_PATH = path.join(__dirname, "extension");
}

export { CHROME_INSPECTOR_SYNC_EXTENSION_PATH };
