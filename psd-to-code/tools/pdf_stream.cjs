// Prints one PDF object's (inflated) stream to stdout and its dictionary to stderr.
// Use it to read the drawing operators of a smart object extracted by psd_smart_objects.cjs.
//   node tools/pdf_stream.cjs <file.pdf> <objectNumber> > stream.txt
const fs = require("fs"), zlib = require("zlib");
const [file, num] = process.argv.slice(2);
const buf = fs.readFileSync(file), s = buf.toString("latin1");
const i = s.indexOf("\n" + num + " 0 obj") >= 0 ? s.indexOf("\n" + num + " 0 obj") : s.indexOf("\r" + num + " 0 obj");
if (i < 0) { console.error("object " + num + " not found"); process.exit(1); }
const st = s.indexOf("stream", i);
let p = st + 6; if (s[p] === "\r") p++; if (s[p] === "\n") p++;
const e = s.indexOf("endstream", p);
console.error(s.slice(i, st).slice(0, 300));
let data = buf.slice(p, e);
try { data = zlib.inflateSync(data); } catch { console.error("(stream is not deflated - printed raw)"); }
process.stdout.write(data);
