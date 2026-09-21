import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
const icons = [
  "upload",
  "chevron-down",
  "chevron-right",
  "chevrons-up-down",
  "search",
  "folder",
  "folder-open",
  "file-code-2",
  "network",
  "layers",
  "circle-help",
  "download",
  "maximize",
  "plus",
  "minus",
  "mouse-pointer-2",
  "grid-2x2",
  "type",
  "check",
  "x",
  "circle-check",
  "circle-alert",
  "box",
  "git-branch",
  "gauge",
  "copy",
  "external-link",
  "arrow-up-right",
  "arrow-right",
  "arrow-left",
  "list-tree",
  "info",
  "eye",
  "eye-off",
  "crosshair",
  "file",
  "braces",
  "database",
  "expand",
  "file-json",
];
async function download(url) {
  // curl uses the host networking configuration, which also works on this Windows workspace.
  const { stdout } = await execute(
    process.platform === "win32" ? "curl.exe" : "curl",
    [
      "-sS",
      "-L",
      "--fail",
      "--retry",
      "3",
      "--connect-timeout",
      "20",
      "--max-time",
      "60",
      url,
    ],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  return stdout;
}
const dir = new URL("../public/icons/", import.meta.url);
await mkdir(dir, { recursive: true });
for (let i = 0; i < icons.length; i += 4) {
  await Promise.all(
    icons.slice(i, i + 4).map(async (name) => {
      const url = `https://raw.githubusercontent.com/lucide-icons/lucide/0.468.0/icons/${name}.svg`;
      const svg = await download(url);
      if (!svg.includes("<svg")) throw new Error(`Invalid SVG: ${name}`);
      await writeFile(new URL(`${name}.svg`, dir), svg);
    }),
  );
}
const license = await download(
  "https://raw.githubusercontent.com/lucide-icons/lucide/0.468.0/LICENSE",
);
await writeFile(new URL("LICENSE", dir), license);
await writeFile(
  new URL("SOURCE.txt", dir),
  "Lucide icons v0.468.0\nSource: https://github.com/lucide-icons/lucide/tree/0.468.0/icons\nLicense: ISC (see LICENSE)\nDownloaded with scripts/download-icons.mjs\n",
);
console.log("Lucide SVG icons and license downloaded.");
