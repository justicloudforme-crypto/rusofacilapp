/**
 * КАКАЯ УЧЁТКА ОТКРЫВАЕТСЯ ПРИ ВХОДЕ ЧЕРЕЗ GOOGLE (заход 7.267).
 *
 * ГЛАВНОЕ ПРАВИЛО. Google подтвердил адрес, и такой адрес у нас уже есть —
 * входим в СУЩЕСТВУЮЩУЮ учётку. Новая — только если адрес у нас не
 * встречается вовсе. Иначе у человека раздвоятся прогресс и покупки:
 * RevenueCat привязан к нашему `User.id` (`NativeStoreIdentity`), Stripe —
 * к `stripeCustomerId` той же строки.
 *
 * КАК СРАВНИВАЕТСЯ АДРЕС.
 *   1. Без учёта регистра и пробелов по краям: «Foo@Gmail.com » = «foo@gmail.com».
 *      Все пути записи у нас кладут адрес в нижнем регистре (замер прода
 *      7.267: 0 из 36 строк не в нижнем регистре), поэтому первым идёт
 *      поиск по уникальному индексу — одно чтение.
 *   2. Если по индексу не нашлось — один просмотр строк того же домена и
 *      сравнение уже в коде (на случай строки, записанной в обход
 *      нормализации). Просмотр бывает только у нового человека, не на
 *      каждом входе.
 *   3. Только для gmail.com/googlemail.com — без точек и «+метки» в имени:
 *      это один и тот же ящик Gmail, и Google подтвердил, что он у
 *      человека. Замер прода 7.267: из 30 адресов Gmail у 6 есть точка.
 *      Если так совпали ДВЕ строки — отказ «ambiguous» (угадывать нельзя).
 *
 * Неподтверждённый адрес сюда не доходит — его отвергает проверка токена
 * (`email_unverified`), но правило повторено и здесь: эта функция не
 * должна открывать учётку ни при каком входе.
 */

export interface GoogleAccountRow {
  id: string;
  email: string;
  sessionVersion: number;
}

/** Ровно те вызовы базы, что нужны. Боевая реализация — `prismaAccountStore`. */
export interface GoogleAccountStore {
  /** Точное совпадение по уникальному индексу. */
  findByEmail(email: string): Promise<GoogleAccountRow | null>;
  /** Строки, чей адрес оканчивается на «@домен» (в SQLite LIKE — без учёта регистра ASCII). */
  findByDomain(domain: string): Promise<GoogleAccountRow[]>;
  create(email: string): Promise<GoogleAccountRow>;
}

export type GoogleAccountOutcome =
  | { kind: "existing"; user: GoogleAccountRow }
  | { kind: "created"; user: GoogleAccountRow }
  | { kind: "refused"; reason: "email_unverified" | "ambiguous" | "invalid_email" };

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Ключ «один и тот же ящик»: регистр всегда, точки и «+» — только у Gmail. */
export function mailboxKey(raw: string): string {
  const email = normalizeEmail(raw);
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!GMAIL_DOMAINS.has(domain)) return email;
  return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
}

export async function resolveGoogleAccount(
  store: GoogleAccountStore,
  identity: { email: string; emailVerified: boolean }
): Promise<GoogleAccountOutcome> {
  if (!identity.emailVerified) return { kind: "refused", reason: "email_unverified" };
  const email = normalizeEmail(identity.email);
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return { kind: "refused", reason: "invalid_email" };

  const exact = await store.findByEmail(email);
  if (exact) return { kind: "existing", user: exact };

  const domain = email.slice(at + 1);
  const domains = GMAIL_DOMAINS.has(domain) ? [...GMAIL_DOMAINS] : [domain];
  const candidates = (await Promise.all(domains.map((d) => store.findByDomain(d)))).flat();

  const sameAddress = candidates.filter((row) => normalizeEmail(row.email) === email);
  if (sameAddress.length === 1) return { kind: "existing", user: sameAddress[0] };
  if (sameAddress.length > 1) return { kind: "refused", reason: "ambiguous" };

  const key = mailboxKey(email);
  const sameMailbox = candidates.filter((row) => mailboxKey(row.email) === key);
  if (sameMailbox.length === 1) return { kind: "existing", user: sameMailbox[0] };
  if (sameMailbox.length > 1) return { kind: "refused", reason: "ambiguous" };

  try {
    return { kind: "created", user: await store.create(email) };
  } catch (error) {
    // Два входа одним адресом в одну секунду: второй упирается в
    // уникальность — значит строка уже есть, и это вход в неё.
    const raced = await store.findByEmail(email);
    if (raced) return { kind: "existing", user: raced };
    throw error;
  }
}

type UserDelegate = {
  findUnique(args: { where: { email: string }; select: Record<string, true> }): Promise<GoogleAccountRow | null>;
  findMany(args: { where: { email: { endsWith: string } }; select: Record<string, true> }): Promise<GoogleAccountRow[]>;
  create(args: { data: { email: string }; select: Record<string, true> }): Promise<GoogleAccountRow>;
};

const SELECT = { id: true, email: true, sessionVersion: true } as const;

export function prismaAccountStore(db: { user: unknown }): GoogleAccountStore {
  const user = db.user as UserDelegate;
  return {
    findByEmail: (email) => user.findUnique({ where: { email }, select: SELECT }),
    findByDomain: (domain) => user.findMany({ where: { email: { endsWith: `@${domain}` } }, select: SELECT }),
    // Пароля нет: учётка входит через Google. «¿Olvidaste tu contraseña?»
    // пришлёт ссылку, по которой пароль можно завести.
    create: (email) => user.create({ data: { email }, select: SELECT }),
  };
}
