const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "dist-web");
const bundlePath = path.join(projectRoot, "release", "web", "js", "bundle.js");

function readCompiled(relativePath) {
  return fs.readFileSync(path.join(outDir, relativePath), "utf8");
}

execFileSync("tsc", ["-p", path.join(projectRoot, "tsconfig.web.json")], {
  cwd: projectRoot,
  stdio: "inherit",
});

const modules = {
  "./game/gameLogic": readCompiled("src/game/gameLogic.js"),
  "./Main": readCompiled("src/Main.js"),
};

const moduleEntries = Object.entries(modules)
  .map(([id, code]) => {
    return `${JSON.stringify(id)}: function(module, exports, require) {\n${code}\n}`;
  })
  .join(",\n");

const bundle = `"use strict";
(() => {
  const modules = {
${moduleEntries}
  };
  const cache = {};
  function requireModule(id) {
    if (cache[id]) {
      return cache[id].exports;
    }
    const factory = modules[id];
    if (!factory) {
      throw new Error("Cannot find module " + id);
    }
    const module = { exports: {} };
    cache[id] = module;
    factory(module, module.exports, requireModule);
    return module.exports;
  }
  requireModule("./Main");
})();
`;

fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
fs.writeFileSync(bundlePath, bundle);
