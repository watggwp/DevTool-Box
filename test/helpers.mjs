// Shared helpers for the test suite (node:test, no dependencies).
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const JS = path.join(ROOT, "src/assets/js");

// Import a pure ES module from src/assets/js (only for files that do not touch the DOM at load time).
export const importJs = (name) => import(pathToFileURL(path.join(JS, name)).href);

// Some browser scripts mix pure helpers with DOM setup. Pull named top-level declarations out of the
// source text and evaluate just those, so the pure logic can be tested in Node.
export function extract(file, names, extraReturn = names) {
  const src = readFileSync(path.join(JS, file), "utf8").replace(/\r\n/g, "\n");
  const lines = src.split("\n");
  const pieces = names.map((name) => {
    const start = lines.findIndex((l) => new RegExp(`^(?:export )?(?:async )?(?:function ${name}\\b|const ${name} =)`).test(l));
    if (start < 0) throw new Error(`${name} not found in ${file}`);
    let end = start;
    // a one-line declaration ends on its own line; otherwise stop at the closing brace in column 0
    if (!/;\s*$/.test(lines[start]) || /\{\s*$/.test(lines[start])) {
      while (end < lines.length - 1 && !/^(\}|\}\)\(\);|\];|\};)\s*$/.test(lines[end])) end++;
    }
    return lines.slice(start, end + 1).join("\n").replace(/^export /, "");
  });
  return new Function(`${pieces.join("\n")}\nreturn { ${extraReturn.join(", ")} };`)();
}

export const readText = (rel) => readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, "");
