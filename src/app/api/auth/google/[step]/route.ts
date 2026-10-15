import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { googleCallback, googleNative, googleNonce, googleStart } from "@/lib/google-auth/handlers";

/**
 * Вход через Google (заход 7.267), один маршрут на четыре шага:
 *   GET  /api/auth/google/start    — веб: уход на страницу Google;
 *   GET  /api/auth/google/callback — веб: возврат с кодом;
 *   POST /api/auth/google/nonce    — приложение: одноразовое число;
 *   POST /api/auth/google/native   — приложение: проверка ID-токена.
 * Без настроек в Vercel каждый шаг отвечает 404 (`googleSignInConfig`).
 */
const notFound = () => new NextResponse("Not Found", { status: 404 });

export async function GET(request: NextRequest, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (step === "start") return googleStart(request);
  if (step === "callback") return googleCallback(request);
  return notFound();
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (step === "nonce") return googleNonce();
  if (step === "native") return googleNative(request);
  return notFound();
}
