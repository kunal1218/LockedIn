const { execSync } = require("node:child_process");

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

function ensureLightningCssBinary() {
  const pkgName = getLightningCssPackage();

  try {
    require.resolve(pkgName);
    return;
  } catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }

  let version;
  try {
    version = require("lightningcss/package.json").version;
  } catch (error) {
    console.warn(
      "[ensure-lightningcss] lightningcss is not installed; skipping binary check."
    );
    return;
  }

  console.log(
    `[ensure-lightningcss] Installing ${pkgName}@${version} to satisfy optional native bindings.`
  );
  execSync(`npm install --no-save --ignore-scripts ${pkgName}@${version}`, {
    stdio: "inherit",
  });
}

ensureLightningCssBinary();
