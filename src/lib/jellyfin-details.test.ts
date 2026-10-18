import { describe, expect, it } from "vitest";
import {
  buildCodecDetailRows,
  formatDetailValue,
  formatTranscodeReasons,
} from "@/lib/jellyfin-display";
import type { JellyfinPlayback } from "@/lib/integrations/jellyfin/types";

function playbackStub(overrides: Partial<JellyfinPlayback> = {}): JellyfinPlayback {
  return {
    method: "transcode",
    sourceVideoCodec: "h264",
    sourceAudioCodec: "aac",
    sourceResolution: "1920x1080",
    outputVideoCodec: "hevc",
    outputAudioCodec: "aac",
    outputResolution: "1280x720",
    transcodeReasons: ["VideoBitrateNotSupported"],
    ...overrides,
  };
}

describe("buildCodecDetailRows", () => {
  it("separates source and output codecs/resolution independently", () => {
    expect(buildCodecDetailRows(playbackStub())).toEqual([
      { label: "Video codec", source: "h264", output: "hevc" },
      { label: "Audio codec", source: "aac", output: "aac" },
      { label: "Resolution", source: "1920x1080", output: "1280x720" },
    ]);
  });

  it("keeps source and output independent when output is null", () => {
    const rows = buildCodecDetailRows(
      playbackStub({ outputVideoCodec: null, outputAudioCodec: null, outputResolution: null }),
    );
    expect(rows[0]).toEqual({ label: "Video codec", source: "h264", output: null });
    expect(rows[1]).toEqual({ label: "Audio codec", source: "aac", output: null });
    expect(rows[2]).toEqual({ label: "Resolution", source: "1920x1080", output: null });
  });

  it("keeps source and output independent when source is null", () => {
    const rows = buildCodecDetailRows(
      playbackStub({ sourceVideoCodec: null, sourceAudioCodec: null, sourceResolution: null }),
    );
    expect(rows[0]).toEqual({ label: "Video codec", source: null, output: "hevc" });
    expect(rows[1]).toEqual({ label: "Audio codec", source: null, output: "aac" });
    expect(rows[2]).toEqual({ label: "Resolution", source: null, output: "1280x720" });
  });
});

describe("formatDetailValue", () => {
  it("returns the value unchanged when present", () => {
    expect(formatDetailValue("h264")).toBe("h264");
  });

  it("returns an em dash for null and empty values", () => {
    expect(formatDetailValue(null)).toBe("—");
    expect(formatDetailValue("")).toBe("—");
    expect(formatDetailValue("   ")).toBe("—");
  });

  it("trims surrounding whitespace from a present value", () => {
    expect(formatDetailValue("  h264  ")).toBe("h264");
  });
});

describe("formatTranscodeReasons", () => {
  it("joins multiple reasons with a comma separator", () => {
    expect(formatTranscodeReasons(["A", "B"])).toBe("A, B");
  });

  it("returns null when there are no reasons", () => {
    expect(formatTranscodeReasons([])).toBeNull();
    expect(formatTranscodeReasons(null)).toBeNull();
    expect(formatTranscodeReasons(undefined)).toBeNull();
    expect(formatTranscodeReasons(["", "  "])).toBeNull();
  });
});
