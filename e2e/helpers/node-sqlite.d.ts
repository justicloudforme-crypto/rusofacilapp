/**
 * Ровно та часть `node:sqlite`, которой пользуется
 * `e2e/search-demand-log.spec.ts`, — и ни знака сверх неё.
 *
 * Почему объявление своё, а не из пакета: в проекте стоит `@types/node`
 * версии 20, а `node:sqlite` появился позже; поднимать типы всего Node
 * ради трёх методов в одной спеке — правка, задевающая каждый файл
 * репозитория. Сам модуль встроен в Node (прогон идёт на 24-м), новой
 * зависимости здесь не появляется.
 */
declare module "node:sqlite" {
  interface StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  }

  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean; timeout?: number });
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
