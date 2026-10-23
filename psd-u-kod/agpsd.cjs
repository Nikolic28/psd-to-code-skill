// ag-psd za sve alate ovog skilla: instalira se jednom u folder skilla (ne u projekat).
//   const agp = require(path.join(os.homedir(), ".claude/skills/psd-u-kod/agpsd.cjs"));
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const dir = path.join(__dirname, "node_modules", "ag-psd");
if (!fs.existsSync(dir)) {
  console.error("(jednokratno) instaliram ag-psd u " + __dirname + " ...");
  execSync("npm install --no-save --no-audit --no-fund ag-psd", { cwd: __dirname, stdio: "inherit" });
}
module.exports = require(dir);
