let CHROME_INSPECTOR_SYNC_EXTENSION_PATH: string | undefined;

if (typeof window === "undefined") {
  const u = "url";
  const { fileURLToPath } = await import(u);
  const p = "path";
  const path = await import(p);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  CHROME_INSPECTOR_SYNC_EXTENSION_PATH = path.join(__dirname, "extension");
}

export { CHROME_INSPECTOR_SYNC_EXTENSION_PATH };
