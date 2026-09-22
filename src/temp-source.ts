import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

export interface TempSource {
  filePath: string;
  cleanup: () => void;
}

export function writeTempSource(code: string, stdinFilePath: string): TempSource {
  const ext = extname(stdinFilePath) || ".ts";
  const dir = join(tmpdir(), `agent-lint-${process.pid}-${randomBytes(4).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `stdin${ext}`);
  writeFileSync(filePath, code, "utf8");
  return {
    filePath,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
