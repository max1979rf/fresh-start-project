import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, legacyHash } from "../utils/crypto";

describe("legacyHash", () => {
  it("produces deterministic h_ prefix output", () => {
    const h = legacyHash("admin123");
    expect(h).toMatch(/^h_/);
    expect(h).toBe(legacyHash("admin123"));
  });

  it("produces different hashes for different inputs", () => {
    expect(legacyHash("admin123")).not.toBe(legacyHash("123456"));
  });
});

describe("hashPassword + verifyPassword (PBKDF2)", () => {
  it("verifies a newly hashed password", async () => {
    const hash = await hashPassword("minha-senha-segura");
    expect(hash).toMatch(/^pbkdf2:/);
    await expect(verifyPassword("minha-senha-segura", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correta");
    await expect(verifyPassword("errada", hash)).resolves.toBe(false);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const h1 = await hashPassword("mesma-senha");
    const h2 = await hashPassword("mesma-senha");
    expect(h1).not.toBe(h2);
    // But both verify correctly
    await expect(verifyPassword("mesma-senha", h1)).resolves.toBe(true);
    await expect(verifyPassword("mesma-senha", h2)).resolves.toBe(true);
  });
});

describe("verifyPassword — backward compatibility with legacy h_ hashes", () => {
  it("verifies legacy admin123 hash", async () => {
    const legacy = legacyHash("admin123");
    await expect(verifyPassword("admin123", legacy)).resolves.toBe(true);
  });

  it("rejects wrong password against legacy hash", async () => {
    const legacy = legacyHash("admin123");
    await expect(verifyPassword("wrong", legacy)).resolves.toBe(false);
  });

  it("returns false for completely invalid hash format", async () => {
    await expect(verifyPassword("test", "invalid-hash")).resolves.toBe(false);
  });
});
