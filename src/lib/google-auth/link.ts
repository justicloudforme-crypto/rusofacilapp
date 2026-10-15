import { createHash } from "node:crypto";
import { normalizeEmail } from "@/lib/google-auth/account";

/**
 * ПЕРВАЯ ПРИВЯЗКА GOOGLE К УЧЁТКЕ С ПАРОЛЕМ — долг 381, заход 7.268,
 * решение владельца «вариант а».
 *
 * УГРОЗА. Регистрация паролем адрес не подтверждает (так с 16.08.2026).
 * Кто-то заранее регистрирует чужой Gmail со своим паролем; позже хозяин
 * ящика входит через Google и по правилу 7.267 попадает в ЭТУ учётку — а у
 * регистрировавшего остаются пароль и, возможно, открытые сессии.
 *
 * ПРАВИЛО. Google адрес проверил, регистрация — нет, поэтому при ПЕРВОМ
 * входе через Google в учётку с паролем:
 *   1) пароль снимается (`passwordHash = NULL`) — дальше учётка такая же,
 *      как созданная через Google: пароль заводится письмом
 *      «¿Olvidaste tu contraseña?», и только хозяином ящика;
 *   2) `sessionVersion + 1` — все выданные раньше сессии гаснут; сессию
 *      этого входа вызывающий выдаёт уже с новой версией;
 *   3) письмо хозяину ящика (шлёт `sign-in.ts`, не этот модуль).
 * Всё в базе — ОДНИМ `UPDATE … WHERE id = ? AND googleLinkedAt IS NULL`:
 * два одновременных первых входа сбросят пароль один раз, а не дважды.
 *
 * ПЕРВАЯ ИЛИ ПОВТОРНАЯ. Признак — `User.googleLinkedAt`: NULL — через
 * Google сюда ещё не входили. Повторный вход (колонка заполнена) ничего не
 * меняет. Учётку без пароля правило не трогает — ей только ставится
 * отметка привязки.
 *
 * ПРИВЯЗАННЫЕ ДО 7.268. До этого захода привязка нигде не записывалась
 * (вход по 7.267 просто находил учётку по адресу), поэтому у учёток, куда
 * уже входили через Google, колонка NULL. Известна одна такая учётка с
 * паролем — владельца, проверка 15.10.2026 на компьютере и на POCO; ей
 * отметка ставится без сброса. В публичном репозитории хранится не адрес,
 * а SHA-256 нормализованного адреса. Других следов входа через Google за
 * 15.10 в базе нет, так что для остальных учёток первый вход после выката
 * считается первой привязкой.
 */
const LINKED_BEFORE_7268 = new Set(["1cfdb3f00cbccce72328e4fdf44e0a2c81b26b968e9a599f7a6af89c4659f875"]);

export function linkedBefore7268(email: string): boolean {
  return LINKED_BEFORE_7268.has(createHash("sha256").update(normalizeEmail(email)).digest("hex"));
}

export interface GoogleLinkRow {
  email: string;
  passwordHash: string | null;
  googleLinkedAt: Date | null;
  sessionVersion: number;
}

/** Ровно те вызовы базы, что нужны. Боевая реализация — `prismaLinkStore`. */
export interface GoogleLinkStore {
  read(userId: string): Promise<GoogleLinkRow | null>;
  /** Отметка привязки без сброса; `true`, если отметку поставил этот вызов. */
  markLinked(userId: string, at: Date): Promise<boolean>;
  /**
   * Отметка + снятие пароля + `sessionVersion + 1` одной записью, только
   * если отметки ещё нет. Возвращает, сработала ли запись, и версию сессии
   * после неё.
   */
  markLinkedAndResetPassword(userId: string, at: Date): Promise<{ reset: boolean; sessionVersion: number }>;
}

export type GoogleLinkOutcome =
  | { kind: "repeat"; sessionVersion: number }
  | { kind: "linked"; sessionVersion: number }
  | { kind: "password_disabled"; sessionVersion: number; email: string };

export async function linkGoogleOnSignIn(store: GoogleLinkStore, userId: string, now = new Date()): Promise<GoogleLinkOutcome> {
  const row = await store.read(userId);
  if (!row) throw new Error("google link: user vanished between lookup and link");
  if (row.googleLinkedAt) return { kind: "repeat", sessionVersion: row.sessionVersion };

  if (!row.passwordHash || linkedBefore7268(row.email)) {
    await store.markLinked(userId, now);
    return { kind: "linked", sessionVersion: row.sessionVersion };
  }

  const result = await store.markLinkedAndResetPassword(userId, now);
  // Запись не сработала — отметку за миг до нас поставил параллельный вход
  // (он же и сбросил пароль, и послал письмо). Это повторный вход.
  if (!result.reset) return { kind: "repeat", sessionVersion: result.sessionVersion };
  return { kind: "password_disabled", sessionVersion: result.sessionVersion, email: row.email };
}

type LinkUserDelegate = {
  findUnique(args: { where: { id: string }; select: Record<string, true> }): Promise<GoogleLinkRow | null>;
  updateMany(args: { where: { id: string; googleLinkedAt: null }; data: Record<string, unknown> }): Promise<{ count: number }>;
};

type LinkDb = {
  user: unknown;
  $transaction(queries: unknown[]): Promise<unknown[]>;
};

export function prismaLinkStore(db: LinkDb): GoogleLinkStore {
  const user = db.user as LinkUserDelegate;
  return {
    read: (id) =>
      user.findUnique({ where: { id }, select: { email: true, passwordHash: true, googleLinkedAt: true, sessionVersion: true } }),
    markLinked: async (id, at) => (await user.updateMany({ where: { id, googleLinkedAt: null }, data: { googleLinkedAt: at } })).count === 1,
    markLinkedAndResetPassword: async (id, at) => {
      // Одна транзакция: запись и чтение версии, которую получит сессия
      // этого входа. Отпечаток пароля в ссылках «сброс пароля» меняется
      // вместе с `passwordHash`, так что и они гаснут.
      const [updated, fresh] = (await db.$transaction([
        user.updateMany({
          where: { id, googleLinkedAt: null },
          data: { googleLinkedAt: at, passwordHash: null, sessionVersion: { increment: 1 } },
        }),
        user.findUnique({ where: { id }, select: { sessionVersion: true } }),
      ])) as [{ count: number }, { sessionVersion: number } | null];
      return { reset: updated.count === 1, sessionVersion: fresh?.sessionVersion ?? 0 };
    },
  };
}
