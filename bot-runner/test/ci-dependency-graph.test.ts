import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
  });
}

test("CI reverse graph includes every literal local import found by TypeScript", () => {
  const result = spawnSync("python3", ["deploy/ci-feature-tests.py", "--graph"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout) as Record<string, string[]>;
  for (const file of [...walk(join(root, "bot-runner/src")), ...walk(join(root, "bot-runner/test"))]) {
    for (const imported of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
      if (!imported.fileName.startsWith(".")) continue;
      const target = resolve(dirname(file), imported.fileName);
      const source = [target, target.replace(/\.js$/, ".ts"), `${target}.ts`, join(target, "index.ts")]
        .find(candidate => candidate.endsWith(".ts") && existsSync(candidate));
      if (!source) continue;
      const owner = relative(root, source);
      const consumer = relative(root, file);
      assert.ok(graph[owner]?.includes(consumer), `Missing reverse import: ${owner} -> ${consumer}`);
    }
  }
});
