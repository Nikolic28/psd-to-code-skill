// ag-psd for every tool in this skill: installed once into the skill folder (not into the project).
//   const agp = require(path.join(os.homedir(), ".claude/skills/psd-to-code/agpsd.cjs"));
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const dir = path.join(__dirname, "node_modules", "ag-psd");
if (!fs.existsSync(dir)) {
  console.error("(one-time) installing ag-psd into " + __dirname + " ...");
  execSync("npm install --no-save --no-audit --no-fund ag-psd", { cwd: __dirname, stdio: "inherit" });
}
module.exports = require(dir);
