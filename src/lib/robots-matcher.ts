/**
 * robots.txt path matching, with Allow weighed against Disallow.
 *
 * This lived inside crawlable-surface.test.ts, where nothing else could
 * import it — so every audit script rewrote it from the prose description
 * in PROGRESS.md, and at least one rewrite got it wrong in the direction
 * that fails silently: treating `Allow:` as absent counted all 160 free
 * puzzle URLs — pages robots.txt opens on purpose — as blocked, and the
 * only symptom was a slightly smaller number of rows.
 *
 * Google's rule ("Order of precedence for rules"): the LONGEST matching
 * path pattern wins, wildcards count as ordinary characters when measuring
 * length, and Allow wins an exact tie. `Allow: /` is length 1 and
 * therefore overrides nothing.
 *
 * No dependencies and no `server-only`: this has to be importable from a
 * unit test, a page, and a throwaway audit script alike.
 */

/** One parsed rule. `pattern` is kept verbatim because its LENGTH is what
 * decides precedence — a normalised or expanded form would rank wrong. */
import { escapeRegExp } from "./regex";

export interface RobotsRule {
  pattern: string;
  allow: boolean;
}

/**
 * robots.txt path pattern -> matcher. `*` is any run of characters, a
 * trailing `$` anchors the end, everything else is a prefix match.
 *
 * Every literal chunk goes through escaping before it reaches `RegExp` —
 * a pattern is data (it comes out of a served robots.txt), and data in a
 * pattern is the rule from PROGRESS.md 4.4.
 *
 * Uses the shared escapeRegExp rather than its own copy. It used to inline
 * the same character class, and after incident №1 that copy was the OLD,
 * broken escaping (`\-`) living on beside the fixed one — harmless only
 * because there is no `u` flag here, which is a property of this line
 * today, not of the code. regex.ts exists precisely so there is one of
 * these, not four.
 */
export function matchesRobotsPattern(path: string, pattern: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source =
    "^" +
    body
      .split("*")
      .map((part) => escapeRegExp(part))
      .join(".*") +
    (anchored ? "$" : "");
  return new RegExp(source).test(path);
}

/** The rule that wins for `path`, or null when nothing matches. Exported
 * because an audit usually wants to name the deciding line, not just the
 * verdict. */
export function decidingRule(path: string, rules: RobotsRule[]): RobotsRule | null {
  let best: RobotsRule | null = null;
  for (const rule of rules) {
    if (rule.pattern === "" || !matchesRobotsPattern(path, rule.pattern)) continue;
    if (
      best === null ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
    ) {
      best = rule;
    }
  }
  return best;
}

/** True if a crawler obeying robots.txt is kept off `path`. */
export function isDisallowed(path: string, disallows: string[], allows: string[] = []): boolean {
  const rules: RobotsRule[] = [
    ...disallows.map((pattern) => ({ pattern, allow: false })),
    ...allows.map((pattern) => ({ pattern, allow: true })),
  ];
  const best = decidingRule(path, rules);
  return best !== null && !best.allow;
}

/** Parse a served robots.txt body into rules. Directive names are matched
 * case-insensitively because the spec treats them that way and a crawler
 * does too — the same reason attribute names are read case-insensitively
 * (PROGRESS.md 4.2). */
export function parseRobotsTxt(body: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  for (const line of body.split("\n")) {
    const m = line.trim().match(/^(Allow|Disallow)\s*:\s*(\S*)$/i);
    if (!m) continue;
    rules.push({ pattern: m[2], allow: m[1].toLowerCase() === "allow" });
  }
  return rules;
}

/** The naive matcher that only looks at Disallow — kept so tests and
 * audits can DEMONSTRATE that it disagrees with the correct one on real
 * input, rather than asserting that it would. A control built from the
 * convenient cases passes on the broken version too (PROGRESS.md 4.5). */
export function isDisallowedIgnoringAllow(path: string, disallows: string[]): boolean {
  return disallows.some((pattern) => pattern !== "" && matchesRobotsPattern(path, pattern));
}
