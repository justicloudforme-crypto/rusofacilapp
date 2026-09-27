import { describe, expect, it, vi } from "vitest";
import {
  GUEST_OWNER,
  OUTBOX_LIMIT,
  countWith,
  enqueueWith,
  flushWith,
  latestPendingWith,
  pendingPassedWith,
  restoreAttemptWith,
  verdictOf,
  type OutboxBody,
  type OutboxRecord,
  type OutboxStore,
} from "./progress-outbox";
import type { PostResult } from "./reliable-post";
import { ANONYMOUS_OWNER_SCOPE } from "./recordings-owner";

function memoryStore(): OutboxStore & { rows: OutboxRecord[] } {
  let next = 1;
  const rows: OutboxRecord[] = [];
  return {
    rows,
    add: async (r) => {
      const id = next++;
      rows.push({ ...r, id });
      return id;
    },
    all: async () => rows.map((r) => ({ ...r })),
    remove: async (id) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
  };
}

function body(owner: string, key: string, lesson = "1"): OutboxBody {
  return { level: "a1", lesson, score: 50, passed: false, mistakes: [], answers: {}, key, at: 1, owner };
}

const ok = (extra: unknown = { ok: true }): PostResult => ({ outcome: "ok", status: 200, body: extra, beacon: false });
const lost: PostResult = { outcome: "lost", status: null, body: null, beacon: false };
const status = (s: number): PostResult => ({ outcome: "rejected", status: s, body: null, beacon: false });

describe("очередь ответов без сети (7.236)", () => {
  it("контроль: запись владельца уходит и снимается; порядок — порядок добавления", async () => {
    const store = memoryStore();
    await enqueueWith(store, body("A", "k1"));
    await enqueueWith(store, body("A", "k2"));
    const send = vi.fn().mockResolvedValue(ok());
    const report = await flushWith(store, "A", send);
    expect(report.sent).toBe(2);
    expect(store.rows).toHaveLength(0);
    expect(send.mock.calls.map((c) => c[1].key)).toEqual(["k1", "k2"]);
    expect(send.mock.calls[0][2]).toMatchObject({ beacon: false });
  });

  it("сеть рвётся посреди отправки: первая ушла, вторая осталась, порядок не переставлен", async () => {
    const store = memoryStore();
    await enqueueWith(store, body("A", "k1"));
    await enqueueWith(store, body("A", "k2"));
    await enqueueWith(store, body("A", "k3"));
    const send = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValue(lost);
    const report = await flushWith(store, "A", send);
    expect(report).toMatchObject({ sent: 1, waiting: 2, stoppedBy: "network" });
    expect(send).toHaveBeenCalledTimes(2); // k3 не отправлялась раньше k2
    expect(store.rows.map((r) => r.body.key)).toEqual(["k2", "k3"]);
  });

  it("повтор ключа, принятый сервером как повтор, тоже снимается", async () => {
    const store = memoryStore();
    await enqueueWith(store, body("A", "k1"));
    const report = await flushWith(store, "A", vi.fn().mockResolvedValue(ok({ ok: true, duplicate: true })));
    expect(report).toMatchObject({ sent: 0, duplicate: 1 });
    expect(store.rows).toHaveLength(0);
  });

  it("ПРАВИЛО ВЛАДЕЛЬЦА: записи A под B не отправляются и не стираются", async () => {
    const store = memoryStore();
    await enqueueWith(store, body("A", "k1"));
    await enqueueWith(store, body("B", "k2"));
    const send = vi.fn().mockResolvedValue(ok());
    const report = await flushWith(store, "B", send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1].owner).toBe("B");
    expect(report.foreign).toBe(1);
    expect(store.rows.map((r) => r.owner)).toEqual(["A"]);
    // A вернулся — его запись уходит
    expect((await flushWith(store, "A", send)).sent).toBe(1);
    expect(store.rows).toHaveLength(0);
  });

  it("гость ничего не отправляет", async () => {
    const store = memoryStore();
    await enqueueWith(store, body("A", "k1"));
    const send = vi.fn();
    await flushWith(store, GUEST_OWNER, send);
    expect(send).not.toHaveBeenCalled();
    expect(GUEST_OWNER).toBe(ANONYMOUS_OWNER_SCOPE);
  });

  it("409 — оставить и идти дальше; 401 — оставить и остановиться; 400/403 — снять", async () => {
    expect(verdictOf("rejected", 409, null)).toBe("keep");
    expect(verdictOf("rejected", 401, null)).toBe("stop");
    expect(verdictOf("rejected", 400, null)).toBe("dropped");
    expect(verdictOf("rejected", 403, null)).toBe("dropped");
    expect(verdictOf("lost", 503, null)).toBe("stop");
    const store = memoryStore();
    await enqueueWith(store, body("A", "k1"));
    await enqueueWith(store, body("A", "k2"));
    const report = await flushWith(store, "A", vi.fn().mockResolvedValueOnce(status(409)).mockResolvedValue(ok()));
    expect(report).toMatchObject({ sent: 1, waiting: 1 });
    expect(store.rows.map((r) => r.body.key)).toEqual(["k1"]);
  });

  it("потолок: полная очередь отказывает вслух, а не выбрасывает", async () => {
    const store = memoryStore();
    for (let i = 0; i < OUTBOX_LIMIT; i++) expect(await enqueueWith(store, body("A", `k${i}`))).toBe("queued");
    expect(await enqueueWith(store, body("A", "лишняя"))).toBe("full");
    expect(store.rows).toHaveLength(OUTBOX_LIMIT);
  });

  it("хранилища нет — «unavailable», не исключение", async () => {
    const broken: OutboxStore = { add: () => Promise.reject(new Error("x")), all: () => Promise.reject(new Error("x")), remove: () => Promise.resolve() };
    expect(await enqueueWith(broken, body("A", "k1"))).toBe("unavailable");
    expect(await countWith(broken, "A")).toBe(0);
  });

  it("счёт по уроку — только свои записи этого урока", async () => {
    const store = memoryStore();
    await enqueueWith(store, body("A", "k1", "1"));
    await enqueueWith(store, body("A", "k2", "2"));
    await enqueueWith(store, body("B", "k3", "1"));
    expect(await countWith(store, "A", "a1", "1")).toBe(1);
    expect(await countWith(store, "A")).toBe(2);
  });
});

describe("«intento anterior» — последняя попытка, а не первая дошедшая (7.237)", () => {
  const server18 = { score: 72, passed: false, answers: { e1: "старый" } };
  function withScore(owner: string, key: string, score: number, lesson = "1"): OutboxBody {
    return { ...body(owner, key, lesson), score, answers: { e1: `ответ-${score}` } };
  }

  it("контроль: очередь дошла при досылке — показан ответ сервера, и он спрошен ПОСЛЕ досылки", async () => {
    const store = memoryStore();
    await enqueueWith(store, withScore("A", "k20", 80));
    const order: string[] = [];
    let serverScore = 72;
    const flush = async () => {
      order.push("flush");
      await flushWith(store, "A", vi.fn().mockImplementation(async () => {
        serverScore = 80;
        return ok();
      }));
    };
    const fromServer = async () => {
      order.push("server");
      return { ...server18, score: serverScore };
    };
    const r = await restoreAttemptWith(store, "A", "a1", "1", flush, fromServer);
    expect(order).toEqual(["flush", "server"]);
    expect(r).toMatchObject({ source: "server", attempt: { score: 80 } });
  });

  it("дефект владельца: сеть ещё не готова — показана ждущая запись урока, а не старая попытка сервера", async () => {
    const store = memoryStore();
    await enqueueWith(store, withScore("A", "k20", 80));
    const flush = () => flushWith(store, "A", vi.fn().mockResolvedValue(lost));
    const fromServer = vi.fn().mockResolvedValue(server18);
    const r = await restoreAttemptWith(store, "A", "a1", "1", flush, fromServer);
    expect(r).toMatchObject({ source: "queue", attempt: { score: 80, answers: { e1: "ответ-80" } } });
    // С 7.238 сервер спрашивается и здесь — но только о ЗАЧЁТЕ; ответы и
    // балл на экране по-прежнему из ждущей записи.
    expect(r.attempt?.passed).toBe(false);
  });

  it("из нескольких ждущих — последняя по порядку очереди; чужой урок и чужой владелец не в счёт", async () => {
    const store = memoryStore();
    await enqueueWith(store, withScore("A", "k1", 40));
    await enqueueWith(store, withScore("A", "k2", 60));
    await enqueueWith(store, withScore("A", "k3", 99, "2"));
    await enqueueWith(store, withScore("B", "k4", 10));
    expect((await latestPendingWith(store, "A", "a1", "1"))?.score).toBe(60);
    expect(await latestPendingWith(store, "C", "a1", "1")).toBeNull();
  });

  it("гость: очередь не читается, только сервер; нет ничего — «none»", async () => {
    const store = memoryStore();
    await enqueueWith(store, withScore(GUEST_OWNER, "k1", 50));
    const flush = vi.fn().mockResolvedValue(undefined);
    expect(await restoreAttemptWith(store, GUEST_OWNER, "a1", "1", flush, async () => null)).toEqual({ source: "none", attempt: null });
    expect(flush).not.toHaveBeenCalled();
  });

  it("досылка упала исключением — всё равно ответ, а не пустота", async () => {
    const store = memoryStore();
    const r = await restoreAttemptWith(store, "A", "a1", "1", () => Promise.reject(new Error("x")), async () => server18);
    expect(r.source).toBe("server");
  });
});

describe("зачёт урока — по лучшей попытке (7.238)", () => {
  const failing = (owner: string, key: string, score = 32): OutboxBody => ({ ...body(owner, key), score, passed: false, answers: { e1: `ответ-${score}` } });
  const passing = (owner: string, key: string): OutboxBody => ({ ...body(owner, key), score: 80, passed: true, answers: { e1: "ответ-80" } });
  const lostFlush = (store: OutboxStore) => () => flushWith(store, "A", vi.fn().mockResolvedValue(lost));

  it("дефект владельца: ждёт неудачная повторная, сервер знает сданную — экран последней, зачёт на месте", async () => {
    const store = memoryStore();
    await enqueueWith(store, failing("A", "k8"));
    const r = await restoreAttemptWith(store, "A", "a1", "1", lostFlush(store), async () => ({ score: 80, passed: true, answers: {} }));
    expect(r).toMatchObject({ source: "queue", attempt: { score: 32, passed: true, answers: { e1: "ответ-32" } } });
  });

  it("без сети: сданная и неудачная обе ждут — экран неудачной, зачёт от сданной, сервер не нужен", async () => {
    const store = memoryStore();
    await enqueueWith(store, passing("A", "k1"));
    await enqueueWith(store, failing("A", "k2"));
    const fromServer = vi.fn().mockRejectedValue(new Error("offline"));
    const r = await restoreAttemptWith(store, "A", "a1", "1", lostFlush(store), fromServer);
    expect(r).toMatchObject({ source: "queue", attempt: { score: 32, passed: true } });
    expect(fromServer).not.toHaveBeenCalled();
  });

  it("контроль: урок не сдан ни разу — зачёта нет; сервер без сети — тоже нет", async () => {
    const store = memoryStore();
    await enqueueWith(store, failing("A", "k1"));
    expect((await restoreAttemptWith(store, "A", "a1", "1", lostFlush(store), async () => ({ score: 40, passed: false, answers: {} }))).attempt?.passed).toBe(false);
    expect((await restoreAttemptWith(store, "A", "a1", "1", lostFlush(store), () => Promise.reject(new Error("offline")))).attempt?.passed).toBe(false);
  });

  it("сданная ждущая чужого владельца или урока зачёта не даёт", async () => {
    const store = memoryStore();
    await enqueueWith(store, passing("B", "k1"));
    await enqueueWith(store, { ...passing("A", "k2"), lesson: "2" });
    expect(await pendingPassedWith(store, "A", "a1", "1")).toBe(false);
    expect(await pendingPassedWith(store, "B", "a1", "1")).toBe(true);
  });
});
