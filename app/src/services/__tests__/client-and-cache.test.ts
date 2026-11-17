import { describe, expect, it } from "vitest";
import { ConfigError, validateSupabaseConfig } from "@/lib/supabase/client";
import { createOfflineCache, memoryStore, CACHE_VERSION } from "../offline-cache";

describe("Supabase-konfiguration", () => {
  it("accepterer en offentlig nøgle over https", () => {
    expect(validateSupabaseConfig("https://abc.supabase.co/", "sb_publishable_xyz")).toEqual({ url: "https://abc.supabase.co", key: "sb_publishable_xyz" });
  });
  it("afviser manglende værdier, http og hemmelige nøgler", () => {
    expect(() => validateSupabaseConfig(undefined, "k")).toThrow(ConfigError);
    expect(() => validateSupabaseConfig("http://abc.supabase.co", "k")).toThrow(/https/);
    expect(() => validateSupabaseConfig("https://abc.supabase.co", "sb_secret_123")).toThrow(/HEMMELIG/);
    const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
    const serviceJwt = `${b64({ alg: "HS256" })}.${b64({ role: "service_role" })}.sig`;
    expect(() => validateSupabaseConfig("https://abc.supabase.co", serviceJwt)).toThrow(/HEMMELIG/);
    const anonJwt = `${b64({ alg: "HS256" })}.${b64({ role: "anon" })}.sig`;
    expect(validateSupabaseConfig("https://abc.supabase.co", anonJwt).key).toBe(anonJwt);
  });
});

describe("offline-cache", () => {
  it("gemmer pr. bruger og afviser for gamle data og gammel version", async () => {
    let now = 1_000_000;
    const store = memoryStore();
    const cache = createOfflineCache<{ n: number }>(store, () => now);
    await cache.save("a", { n: 1 });
    await cache.save("b", { n: 2 });
    expect((await cache.load("a"))?.data).toEqual({ n: 1 });
    now += 31 * 864e5;
    expect(await cache.load("a")).toBeNull();
    await store.set("bb-data-c", JSON.stringify({ version: CACHE_VERSION + 1, savedAt: now, data: {} }));
    expect(await cache.load("c")).toBeNull();
    await store.set("bb-data-d", "{ødelagt");
    expect(await cache.load("d")).toBeNull();
  });
  it("clearAll sletter kun appens data", async () => {
    const store = memoryStore();
    await store.set("andet", "x");
    const cache = createOfflineCache<number>(store);
    await cache.save("a", 1);
    await cache.clearAll();
    expect(await store.keys()).toEqual(["andet"]);
  });
});
