import { DEFAULT_SETTINGS, normalizeSettings } from "../options/options.js";
import { assert, test } from "../../tests/test-runner.js";

test("normalizeSettings clamps cache hours", () => {
  const settings = normalizeSettings({ cacheHours: 999 });
  assert(settings.cacheHours === 168, "expected max 168");
});

test("normalizeSettings fills defaults", () => {
  const settings = normalizeSettings({});
  assert(settings.apiBaseUrl === DEFAULT_SETTINGS.apiBaseUrl, "expected default base url");
  assert(settings.apiModel === DEFAULT_SETTINGS.apiModel, "expected default model");
  assert(settings.userId === null, "expected null userId");
});

test("normalizeSettings accepts valid values", () => {
  const settings = normalizeSettings({
    cacheHours: 12,
    userId: 123,
    apiBaseUrl: "https://api.deepseek.com",
    apiModel: "deepseek-chat",
    apiKey: "sk-test"
  });
  assert(settings.cacheHours === 12, "expected 12");
  assert(settings.userId === 123, "expected userId");
  assert(settings.apiBaseUrl === "https://api.deepseek.com", "expected base url");
  assert(settings.apiModel === "deepseek-chat", "expected model");
  assert(settings.apiKey === "sk-test", "expected api key");
});
