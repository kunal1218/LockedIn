const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_LIGHTNING_VERSION = "1.30.2";
const DEFAULT_OXIDE_VERSION = "4.1.18";
const repoRoot = path.resolve(__dirname, "..");

function getPlatformSuffix() {
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

  return parts.join("-");
}

function getLightningCssPackage() {
  return `lightningcss-${getPlatformSuffix()}`;
}

function getOxidePackage() {
  return `@tailwindcss/oxide-${getPlatformSuffix()}`;
}

function findPackageJson(pkg) {
  const segments = pkg.split("/");
  const last = segments.pop();
  const scopePath = segments.length ? [segments[0]] : [];

  const candidates = [
    path.join(process.cwd(), "node_modules", ...scopePath, last, "package.json"),
    path.join(repoRoot, "node_modules", ...scopePath, last, "package.json"),
    path.join(process.cwd(), "..", "node_modules", ...scopePath, last, "package.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function ensurePackageInstalled(pkg, version) {
  try {
    require.resolve(pkg);
    return;
  } catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }

  console.log(`[ensure-lightningcss] Installing ${pkg}@${version}.`);
  execSync(`npm install --no-save --ignore-scripts ${pkg}@${version}`, {
    stdio: "inherit",
    cwd: repoRoot,
  });
}

function ensureNativeBinary(pkgName, version) {
  const pkgPathParts = pkgName.split("/");
  const pkgDir = path.join(repoRoot, "node_modules", ...pkgPathParts);
  const pkgJsonPath = path.join(pkgDir, "package.json");

  // If the directory already exists (even without package.json), assume the native
  // binary is present to avoid npm rename collisions in Vercel's cache.
  if (fs.existsSync(pkgDir)) {
    return;
  }

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
  try {
    execSync(`npm install --no-save --ignore-scripts ${pkgName}@${version}`, {
      stdio: "inherit",
      cwd: repoRoot,
    });
  } catch (error) {
    // If the install failed but the directory now exists, treat it as installed;
    // otherwise rethrow to surface genuine failures.
    if (!fs.existsSync(pkgDir)) {
      throw error;
    }
  }
}

function loadVersion(pkg, fallback) {
  const pkgJsonPath = findPackageJson(pkg);
  if (!pkgJsonPath) return fallback;

  try {
    const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    return parsed.version || fallback;
  } catch {
    return fallback;
  }
}

function run() {
  const lightningVersion = loadVersion("lightningcss", DEFAULT_LIGHTNING_VERSION);
  ensurePackageInstalled("lightningcss", lightningVersion);
  ensureNativeBinary(getLightningCssPackage(), lightningVersion);

  const oxideVersion = loadVersion("@tailwindcss/oxide", DEFAULT_OXIDE_VERSION);
  ensurePackageInstalled("@tailwindcss/oxide", oxideVersion);
  ensureNativeBinary(getOxidePackage(), oxideVersion);
}

run();
