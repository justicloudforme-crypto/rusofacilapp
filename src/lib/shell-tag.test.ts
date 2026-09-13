/**
 * ДОЛГ 174. Метка оболочки проверяется не на копии правила, а на НАСТОЯЩИХ
 * файлах `sentry.*.config.ts`: модуль `@sentry/nextjs` подменяется, из
 * перехваченного `Sentry.init` достаётся ровно тот `beforeSend`, который
 * уедет на прод, и он вызывается на придуманном событии. Проверка копии
 * правила доказывала бы только то, что копия работает — а вопрос стоит
 * иначе: проставляется ли метка В ПРОДУКТЕ.
 *
 * Вторая половина — отрицательная: то же событие без токена в User-Agent
 * обязано получить метку `web`, а не остаться без метки. «Без метки» —
 * это третья категория в Sentry, которой быть не должно.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NATIVE_SHELL_UA_TOKEN,
  SHELL_TAG_KEY,
  SHELL_TAG_NATIVE,
  SHELL_TAG_WEB,
  shellTagFromUserAgent,
  tagShellOnEvent,
  userAgentFromSentryEvent,
} from "./shell-tag";

type BeforeSend = (event: Record<string, unknown>) => Record<string, unknown> | null;

const captured: { beforeSend?: BeforeSend }[] = [];

vi.mock("@sentry/nextjs", () => ({
  init: (options: { beforeSend?: BeforeSend }) => {
    captured.push(options);
  },
}));

/** Токен оболочки внутри правдоподобной строки Android WebView — именно в
 *  такой форме его дописывает `appendUserAgent`: в конец, через пробел. */
const SHELL_UA =
  "Mozilla/5.0 (Linux; Android 14; 23113RKC6G) AppleWebKit/537.36 (KHTML, like Gecko) " +
  `Chrome/131.0.0.0 Mobile Safari/537.36 ${NATIVE_SHELL_UA_TOKEN}`;
const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 14; 23113RKC6G) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/131.0.0.0 Mobile Safari/537.36";

describe("shellTagFromUserAgent", () => {
  it("метит нативную оболочку", () => {
    expect(shellTagFromUserAgent(SHELL_UA)).toBe(SHELL_TAG_NATIVE);
  });

  it("обычный мобильный браузер — веб, а не «без метки»", () => {
    expect(shellTagFromUserAgent(BROWSER_UA)).toBe(SHELL_TAG_WEB);
  });

  it("нет User-Agent вовсе — всё равно веб, значение есть всегда", () => {
    expect(shellTagFromUserAgent(null)).toBe(SHELL_TAG_WEB);
    expect(shellTagFromUserAgent(undefined)).toBe(SHELL_TAG_WEB);
    expect(shellTagFromUserAgent("")).toBe(SHELL_TAG_WEB);
  });
});

describe("userAgentFromSentryEvent", () => {
  it("читает заголовок независимо от регистра имени (ПРАВИЛА ЗАМЕРА 4.2)", () => {
    expect(userAgentFromSentryEvent({ request: { headers: { "User-Agent": SHELL_UA } } })).toBe(SHELL_UA);
    expect(userAgentFromSentryEvent({ request: { headers: { "user-agent": SHELL_UA } } })).toBe(SHELL_UA);
  });

  it("нет запроса или нет заголовка — null", () => {
    expect(userAgentFromSentryEvent({})).toBeNull();
    expect(userAgentFromSentryEvent({ request: { headers: {} } })).toBeNull();
  });
});

describe("tagShellOnEvent", () => {
  it("не перезаписывает метку, поставленную ближе к месту ошибки", () => {
    const event = { tags: { [SHELL_TAG_KEY]: "что-то своё" } };
    expect(tagShellOnEvent(event, SHELL_UA).tags[SHELL_TAG_KEY]).toBe("что-то своё");
  });

  it("сохраняет остальные метки события", () => {
    const event: { tags?: Record<string, unknown> } = { tags: { route: "/es/stories" } };
    const out = tagShellOnEvent(event, SHELL_UA);
    expect(out.tags).toEqual({ route: "/es/stories", [SHELL_TAG_KEY]: SHELL_TAG_NATIVE });
  });
});

describe("НАСТОЯЩИЕ конфигурации Sentry ставят метку", () => {
  beforeEach(() => {
    captured.length = 0;
    vi.resetModules();
    // Гейт деплоя: без него `Sentry.init` зовётся с `enabled: false`, но
    // `beforeSend` в опциях всё равно лежит — и именно он проверяется.
    vi.stubEnv("NEXT_PUBLIC_DEPLOY_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function beforeSendOf(path: string): Promise<BeforeSend> {
    captured.length = 0;
    await import(path);
    const options = captured.at(-1);
    expect(options, `${path} не позвал Sentry.init`).toBeDefined();
    const beforeSend = options?.beforeSend;
    expect(beforeSend, `${path} не объявил beforeSend`).toBeTypeOf("function");
    return beforeSend as BeforeSend;
  }

  it("браузерная: метка берётся из navigator.userAgent — оба конца", async () => {
    const beforeSend = await beforeSendOf("../../sentry.client.config");

    vi.stubGlobal("navigator", { userAgent: SHELL_UA });
    expect(beforeSend({ message: "boom" })?.tags).toMatchObject({ [SHELL_TAG_KEY]: SHELL_TAG_NATIVE });

    vi.stubGlobal("navigator", { userAgent: BROWSER_UA });
    expect(beforeSend({ message: "boom" })?.tags).toMatchObject({ [SHELL_TAG_KEY]: SHELL_TAG_WEB });
  });

  it("серверная: метка берётся из заголовков события — оба конца", async () => {
    const beforeSend = await beforeSendOf("../../sentry.server.config");

    expect(beforeSend({ request: { headers: { "user-agent": SHELL_UA } } })?.tags).toMatchObject({
      [SHELL_TAG_KEY]: SHELL_TAG_NATIVE,
    });
    expect(beforeSend({ request: { headers: { "user-agent": BROWSER_UA } } })?.tags).toMatchObject({
      [SHELL_TAG_KEY]: SHELL_TAG_WEB,
    });
  });

  it("краевая: метка берётся из заголовков события — оба конца", async () => {
    const beforeSend = await beforeSendOf("../../sentry.edge.config");

    expect(beforeSend({ request: { headers: { "user-agent": SHELL_UA } } })?.tags).toMatchObject({
      [SHELL_TAG_KEY]: SHELL_TAG_NATIVE,
    });
    expect(beforeSend({ request: { headers: { "user-agent": BROWSER_UA } } })?.tags).toMatchObject({
      [SHELL_TAG_KEY]: SHELL_TAG_WEB,
    });
  });
});
