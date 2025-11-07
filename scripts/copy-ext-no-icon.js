import fs from "fs";

const src = "./extension";
const dest = "./dist/extension";

// Remove the destination directory if it exists
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}

// Copy the source directory to the destination
fs.cpSync(src, dest, { recursive: true });

// Remove the icon files from the copied extension
fs.rmSync(`${dest}/icons`, { recursive: true, force: true });

const manifestPath = `${dest}/manifest.json`;
let manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
delete manifest.icons;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
