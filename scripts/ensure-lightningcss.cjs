const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_VERSION = "1.30.2";
const repoRoot = path.resolve(__dirname, "..");

function getLightningCssPackage() {
  const parts = [process.platform, process.arch];

  if (process.platform === "linux") {
    const { MUSL, familySync } = require("detect-libc");
    const family = familySync();

    if (family === MUSL) {
      parts.push("musl");
    } else if (process.arch === "arm") {
      parts.push("gnueabihf");
    } else {
      parts.push("gnu");
    }
  } else if (process.platform === "win32") {
    parts.push("msvc");
  }

  return `lightningcss-${parts.join("-")}`;
}

function findLightningCssPackageJson() {
  const candidates = [
    path.join(process.cwd(), "node_modules", "lightningcss", "package.json"),
    path.join(repoRoot, "node_modules", "lightningcss", "package.json"),
    path.join(process.cwd(), "..", "node_modules", "lightningcss", "package.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function ensureLightningCssInstalled(version) {
  try {
    require.resolve("lightningcss");
    return;
  } catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }

  console.log(`[ensure-lightningcss] Installing lightningcss@${version}.`);
  execSync(
    `npm install --no-save --ignore-scripts lightningcss@${version}`,
    {
      stdio: "inherit",
      cwd: repoRoot,
    }
  );
}

function ensureLightningCssBinary(version) {
  const pkgName = getLightningCssPackage();

  try {
    require.resolve(pkgName);
    return;
  } catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }

  console.log(
    `[ensure-lightningcss] Installing ${pkgName}@${version} to satisfy native bindings.`
  );
  execSync(
    `npm install --no-save --ignore-scripts ${pkgName}@${version}`,
    {
      stdio: "inherit",
      cwd: repoRoot,
    }
  );
}

function run() {
  let version = DEFAULT_VERSION;
  const pkgJsonPath = findLightningCssPackageJson();

  if (pkgJsonPath) {
    try {
      const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      version = parsed.version || version;
    } catch {
      // keep default version
    }
  }

  ensureLightningCssInstalled(version);
  ensureLightningCssBinary(version);
}

run();
