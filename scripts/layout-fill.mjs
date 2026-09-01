// "Is the container actually full?" — the third layout measurement.
//
// The other two ask whether the page is too WIDE (`documentElement.
// scrollWidth` past the viewport, `e2e/page-width.spec.ts` and
// `scripts/check-layout-geometry.mjs`). This one asks the opposite
// question, and it is the one nobody was asking: whether a block that
// cannot grow is sitting in a container that did, leaving bare page beside
// it.
//
// Why it exists. Reported by the owner on 02.09.2026 for 768–1024, and
// measured before anything was touched: on /profile the month calendar was
// 384px of content inside a 720px column at 768, 820, 834 AND 1024 alike —
// 53.3%, with 336px of empty page to its right — because `max-w-sm` is a
// fixed cap and nothing above it was a column. The tab strip was drawn full
// width and filled to content, leaving 154px (es) / 163px (ru) of bare bar
// on the right at every one of those widths. The freeze balance was a
// 720px band around one short line. None of it makes the document too wide,
// so both existing checks said `ok` throughout.
//
// THE RULE, in the owner's words: a block is a problem when its content
// covers less than 70% of its container AND that container is wider than
// 700px. Both halves matter — under 700px a narrow block is usually a phone
// column doing the right thing, and above 70% the leftover is margin, not a
// hole.
//
// Measured by ROW, not by element, and that is not a detail. A grid's last,
// partly-filled row is normal; so is one narrow box with another beside it
// filling the rest. What counts is the widest span the row's own members
// cover, against the container's content box. Without that, the first
// version of this scan reported every third card of a three-across grid.
//
// And measured against the FRAME, not against the amount of content in it:
// a grid row with fewer members than the grid has tracks is a missing item,
// not a mis-sized block. See the long note at the track check below — that
// distinction is the whole of PROGRESS.md 7.74.
//
// Lives in a plain .mjs so that BOTH runs use the same source: the hand-run
// check imports it, and so does e2e/page-width.spec.ts, which is the one
// that can log in and therefore the only one that ever sees /profile.

/** The owner's two numbers. Exported so the report can print them and so a
 * control can be written against them rather than against a literal. */
export const FILL_THRESHOLD = 0.7;
export const MIN_CONTAINER_WIDTH = 700;

/**
 * Runs IN THE PAGE. Returns one entry per under-filled row, widest gap
 * first. `opts` is passed explicitly rather than closed over because
 * Playwright serialises this function's source and a closure would arrive
 * undefined.
 */
export function findUnderfilledRows(opts) {
  const threshold = opts.threshold;
  const minContainer = opts.minContainer;
  const rows = [];
  /** How many column tracks a grid was actually given. The USED value of
   * `grid-template-columns` is a space-separated list of pixel lengths in
   * both engines; line names arrive in [brackets] and are not tracks. An
   * implicit grid answers "none" and gets 0, which the caller treats as
   * "no declared frame to measure against". */
  const countTracks = (value) => {
    if (!value || value === "none") return 0;
    const tokens = value.replace(/\[[^\]]*\]/g, " ").trim().split(/\s+/).filter(Boolean);
    return tokens.length;
  };
  const describe = (el) => {
    const cls = String(el.className || "").replace(/\s+/g, " ").trim();
    return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls.slice(0, 90)}"` : ""}>`;
  };

  for (const parent of document.querySelectorAll("body *")) {
    const pcs = getComputedStyle(parent);
    if (pcs.display === "none" || pcs.visibility === "hidden") continue;
    // A modal covers the page by design; it is not the page's layout.
    if (pcs.position === "fixed") continue;
    // A sideways scroller is allowed to be narrower than its contents —
    // that is the other defect, and the other check owns it.
    if (/auto|scroll/.test(pcs.overflowX)) continue;

    const pb = parent.getBoundingClientRect();
    const contentLeft = pb.left + (parseFloat(pcs.paddingLeft) || 0);
    const contentRight = pb.right - (parseFloat(pcs.paddingRight) || 0);
    const contentWidth = contentRight - contentLeft;
    if (contentWidth < minContainer) continue;

    // Text sitting straight inside the container is content too, and it
    // wraps to the full width whatever its element children do.
    let ownText = false;
    for (const node of parent.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim().length > 0) ownText = true;
    }
    if (ownText) continue;

    const kids = [];
    for (const child of parent.children) {
      const ccs = getComputedStyle(child);
      if (ccs.display === "none" || ccs.visibility === "hidden") continue;
      // Out-of-flow children (a badge pinned to a corner, a modal) do not
      // owe the container its width.
      if (ccs.position === "fixed" || ccs.position === "absolute") continue;
      const blockish =
        /flex|grid/.test(pcs.display) || /block|flex|grid|list-item|table/.test(ccs.display);
      if (!blockish) continue;
      const b = child.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      kids.push({ el: child, box: b });
    }
    if (kids.length === 0) continue;

    // Group children into visual rows by vertical overlap.
    const taken = new Set();
    for (let i = 0; i < kids.length; i++) {
      if (taken.has(i)) continue;
      let top = kids[i].box.top;
      let bottom = kids[i].box.bottom;
      const row = [i];
      taken.add(i);
      let grew = true;
      while (grew) {
        grew = false;
        for (let j = 0; j < kids.length; j++) {
          if (taken.has(j)) continue;
          if (kids[j].box.bottom > top + 4 && kids[j].box.top < bottom - 4) {
            taken.add(j);
            row.push(j);
            top = Math.min(top, kids[j].box.top);
            bottom = Math.max(bottom, kids[j].box.bottom);
            grew = true;
          }
        }
      }
      const members = row.map((k) => kids[k]);
      let minLeft = Infinity;
      let maxRight = -Infinity;
      let height = 0;
      for (const m of members) {
        minLeft = Math.min(minLeft, m.box.left);
        maxRight = Math.max(maxRight, m.box.right);
        height = Math.max(height, m.box.height);
      }
      // A one-line strip of chrome is not what the rule is about.
      if (height < 40) continue;

      // A GRID IS MEASURED AGAINST ITS OWN TRACKS, NOT AGAINST HOW MANY
      // ITEMS HAPPEN TO EXIST. This is the frame/content line, and getting
      // it wrong is what turned CI red on 02.09.2026 (PROGRESS.md 7.74):
      // twelve failures, all from two containers, both of them grids that
      // declare more columns than CI's empty fixture gives them items to
      // put in.
      //
      //   /es           <div … sm:grid sm:grid-cols-2>   tracks 468px 468px
      //                 items 1 with an empty card bank, 2 with a real one
      //   /es/profile   <div … sm:grid-cols-3>           tracks 229.328px ×3
      //                 items 2 with no stories, 3 with stories
      //
      // Measured on ONE build against two databases: the track list, the
      // track widths and the container width are identical in both — only
      // the item count moves. So the frame was right and the rule was
      // counting content, which is a defect of the rule.
      //
      // The test is now "does the row fill every track it was given". Fewer
      // members than tracks → the shortfall is a missing item, and the
      // checker cannot tell "nothing is rendered here right now" from
      // "nothing is ever rendered here"; that is a content question and it
      // is honestly out of scope. Members filling every track and STILL
      // under threshold → the tracks themselves are too narrow, which IS a
      // frame defect and is still reported (the negative control below
      // plants exactly that).
      const gridTracks = /grid/.test(pcs.display) ? countTracks(pcs.gridTemplateColumns) : 0;
      if (gridTracks > 0) {
        if (row.length < gridTracks) continue;
      } else if (/grid/.test(pcs.display) && row.length < kids.length) {
        // Implicit grid (`grid-template-columns: none`): fall back to the
        // old shape — a multi-row grid's incomplete last row is normal.
        continue;
      }

      const coverage = (maxRight - minLeft) / contentWidth;
      if (coverage >= threshold) continue;

      const gapLeft = minLeft - contentLeft;
      const gapRight = contentRight - maxRight;

      // CENTRED IS NOT A HOLE. The defect reported, and the one this rule
      // is for, is a block pushed to one side with the leftover all on the
      // other — "левоприжатый, с пустотой справа". A column that is
      // `mx-auto` inside a wider page has the same leftover split evenly
      // and is a deliberate reading measure, not dead space; so is a
      // centred "load more" button. Without this the first run of the rule
      // reported every centred CTA on the site and every mx-auto column,
      // 21 pages of them, and a check that reports the whole site reports
      // nothing.
      const tolerance = Math.max(8, contentWidth * 0.03);
      if (gapLeft > 1 && gapRight > 1 && Math.abs(gapLeft - gapRight) <= tolerance) continue;

      // ONE CONTROL IS NOT A BLOCK. A single link or button sized to its
      // own label is right at any container width; so is a paragraph with
      // its own measure. The rule is about a BLOCK — something with parts —
      // so a lone member has to be a container to count.
      if (members.length === 1) {
        const only = members[0].el;
        const tag = only.tagName.toLowerCase();
        if (tag === "a" || tag === "button" || tag === "input" || tag === "select" || tag === "summary") continue;
        if (only.children.length === 0) continue;
      }

      rows.push({
        container: describe(parent),
        containerWidth: Math.round(contentWidth),
        contentWidth: Math.round(maxRight - minLeft),
        coverage: Math.round(coverage * 1000) / 10,
        gapLeft: Math.round(gapLeft),
        gapRight: Math.round(gapRight),
        block: describe(members[0].el),
        text: (members[0].el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 45),
      });
    }
  }
  rows.sort((a, b) => a.coverage - b.coverage);
  return rows;
}

/** One line per finding, for both callers to print the same way. */
export function formatUnderfilled(row) {
  return (
    `content fills ${row.coverage}% of its container — ${row.contentWidth}px inside ${row.containerWidth}px ` +
    `(${row.gapLeft}px left, ${row.gapRight}px right) in ${row.container} holding ${row.block} "${row.text}"`
  );
}
