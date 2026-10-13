const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const bundlePath = path.join(projectRoot, "release", "web", "js", "bundle.js");

test("web bundle exposes the LayaAir main entry and includes the game script", () => {
  const bundle = fs.readFileSync(bundlePath, "utf8");

  assert.match(bundle, /window\.\$_main_/, "bundle must register the LayaAir startup hook");
  assert.match(bundle, /ArcadeBrickBreaker/, "bundle must include the game boot marker");
  assert.match(bundle, /createGameState/, "bundle must include the gameplay logic");
});
