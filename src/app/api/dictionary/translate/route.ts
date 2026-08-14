import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Free, keyless RU->ES lookup (MyMemory's public translation memory) used
// by the story reader's click-a-word popover. No API key required and no
// account to configure — this keeps the "read a story, tap a word"
// feature working out of the box, matching the app's other demo-mode
// fallbacks (Stripe, mock auth) rather than requiring paid credentials.
const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
const MAX_WORD_LENGTH = 64;
const REQUEST_TIMEOUT_MS = 5000;

interface MyMemoryMatch {
  translation?: string;
  match?: number;
}

interface MyMemoryResponse {
  responseData?: { translatedText?: string };
  matches?: MyMemoryMatch[];
}

export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get("word")?.trim() ?? "";
  if (!word || word.length > MAX_WORD_LENGTH) {
    return NextResponse.json({ error: "invalid_word" }, { status: 400 });
  }

  const upstreamUrl = new URL(MYMEMORY_ENDPOINT);
  upstreamUrl.searchParams.set("q", word);
  upstreamUrl.searchParams.set("langpair", "ru|es");

  try {
    const res = await fetch(upstreamUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    const data: MyMemoryResponse = await res.json();

    // MyMemory's top-level "best" match is sometimes worse than an entry
    // further down its match list (its own scoring is noisy), so pick the
    // highest-scoring candidate ourselves instead of trusting responseData.
    const bestMatch = (data.matches ?? [])
      .filter((entry) => typeof entry.translation === "string" && entry.translation.trim())
      .sort((a, b) => (b.match ?? 0) - (a.match ?? 0))[0];

    const translation = bestMatch?.translation ?? data.responseData?.translatedText;
    if (!translation) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ word, translation: translation.trim() });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
