const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const isWindows = process.platform === "win32";
const npx = isWindows ? "npx.cmd" : "npx";
const outputDir = process.env.WEB_BUILD_DIR || "dist";
const maxWorkers = process.env.WEB_BUILD_MAX_WORKERS || (isWindows ? "1" : "");

function cleanEnv(extraEnv = {}) {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...extraEnv }).filter(
      ([key, value]) => key && !key.startsWith("=") && value !== undefined,
    ),
  );
}

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: cleanEnv(extraEnv),
    stdio: "inherit",
    shell: isWindows,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function writeVersionFile() {
  const version = process.env.APP_VERSION || `${Date.now()}`;
  const payload = {
    version,
    built_at: new Date().toISOString(),
  };
  const target = path.join(outputDir, "version.json");

  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}
`, "utf8");
  console.log(`Wrote ${path.resolve(target)} version=${version}`);
}

const exportArgs = ["expo", "export", "-p", "web", "--output-dir", outputDir];

if (maxWorkers) {
  exportArgs.push("--max-workers", maxWorkers);
}

console.log(`Exporting TGMember web app to ${path.resolve(outputDir)}`);
run(npx, exportArgs);
writeVersionFile();

run(
  npx,
  ["--yes", "workbox-cli@7.3.0", "generateSW", "workbox-config.js"],
  { WEB_BUILD_DIR: outputDir },
);