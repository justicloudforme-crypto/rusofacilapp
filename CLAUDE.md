@AGENTS.md

## Dev server cache

If a newly added route/page returns 404 on the running dev server, this is almost
always a stale `.next` route manifest, not a code bug. Run `npm run dev:clean`
(or `rm -rf .next` and restart `next dev`) before spending time debugging routing
code, then re-check the route.
