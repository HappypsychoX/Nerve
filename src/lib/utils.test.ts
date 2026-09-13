import { describe, expect, it } from "vitest";
import {
  cn,
  formatBytes,
  formatDateTime,
  formatRelative,
  formatUptime,
} from "@/lib/utils";

describe("cn", () => {
  it("joins truthy classes", () => {
    expect(cn("a", false && "b", "c", null, undefined)).toBe("a c");
  });

  it("returns empty string for no classes", () => {
    expect(cn()).toBe("");
  });
});

describe("formatBytes", () => {
  it("handles null/undefined", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
  });

  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2 MB");
  });
});

describe("formatUptime", () => {
  it("handles null/undefined", () => {
    expect(formatUptime(null)).toBe("—");
  });

  it("formats minutes", () => {
    expect(formatUptime(120)).toBe("2m");
  });

  it("formats hours and minutes", () => {
    expect(formatUptime(3660)).toBe("1h 1m");
  });

  it("formats days and hours", () => {
    expect(formatUptime(90000)).toBe("1d 1h");
  });
});

describe("formatDateTime", () => {
  it("includes year", () => {
    const result = formatDateTime("2026-09-13T14:30:00Z");
    expect(result).toMatch(/2026/);
  });

  it("handles invalid input", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("not-a-date")).toBe("—");
  });

  it("accepts epoch ms", () => {
    const result = formatDateTime(1757884200000 + 365 * 24 * 60 * 60 * 1000);
    expect(result).toMatch(/2026/);
  });
});

describe("formatRelative", () => {
  it("handles null/undefined", () => {
    expect(formatRelative(null)).toBe("—");
    expect(formatRelative(undefined)).toBe("—");
  });

  it("returns just now under 5s", () => {
    const now = 100000;
    expect(formatRelative(now - 3000, now)).toBe("just now");
  });

  it("returns seconds under 60s", () => {
    const now = 100000;
    expect(formatRelative(now - 45000, now)).toBe("45s ago");
  });

  it("returns minutes under 60m", () => {
    const now = 10000000;
    expect(formatRelative(now - 5 * 60 * 1000, now)).toBe("5m ago");
  });

  it("returns hours under 24h", () => {
    const now = 100000000;
    expect(formatRelative(now - 3 * 60 * 60 * 1000, now)).toBe("3h ago");
  });

  it("returns days otherwise", () => {
    const now = 100000000;
    expect(formatRelative(now - 3 * 24 * 60 * 60 * 1000, now)).toBe("3d ago");
  });
});
