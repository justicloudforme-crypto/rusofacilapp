// Next.js aliases the bare "server-only" import to a real throwing module
// only inside its own webpack/Turbopack bundler (guarding against
// accidentally importing server code into a client bundle) — Vitest has no
// such alias built in, so resolving the bare specifier fails outright.
// This stub gives Vitest something to resolve to; the guard itself is
// meaningless outside Next's bundler anyway.
export {};
