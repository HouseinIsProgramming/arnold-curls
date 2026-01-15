import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlink, writeFile } from "fs/promises";

describe("run command", () => {
  beforeEach(async () => {
    try { await unlink("flow.json"); } catch {}
  });

  afterEach(async () => {
    try { await unlink("flow.json"); } catch {}
  });

  it("should error when no flow.json exists", async () => {
    const proc = Bun.spawn(["bun", "src/run.ts"]);
    const text = await new Response(proc.stdout).text();
    expect(text).toContain("No flow.json found");
  });

  it("should error when no pending steps", async () => {
    await writeFile("flow.json", JSON.stringify({
      name: "Test",
      baseUrl: "http://example.com",
      context: {},
      steps: []
    }));
    const proc = Bun.spawn(["bun", "src/run.ts"]);
    const text = await new Response(proc.stdout).text();
    expect(text).toContain("No pending steps");
  });
});
