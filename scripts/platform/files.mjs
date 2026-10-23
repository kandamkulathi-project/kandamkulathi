import assert from "node:assert/strict";
import { isAbsolute, relative, resolve } from "node:path";

export function privatePath(path) {
  const root = resolve(".local-data");
  const resolved = resolve(path);
  const difference = relative(root, resolved);
  assert(
    difference && !difference.startsWith("..") && !isAbsolute(difference),
    "Operational output belongs in ignored .local-data",
  );
  return resolved;
}
