import { describe, expect, it } from "vitest";
import { verifyGoogleIdToken } from "./id-token";
import { googleClaims, makeTestSigner } from "./test-tokens";

const AUD = "web-client.apps.googleusercontent.com";
const signer = makeTestSigner();
const other = makeTestSigner(signer.kid); // тот же kid, чужой ключ
const fetchKeys = async () => signer.jwks;
const check = (token: string, nonce = "nonce-1") => verifyGoogleIdToken(token, { audience: AUD, nonce, fetchKeys });

describe("verifyGoogleIdToken (7.267)", () => {
  it("принимает настоящий токен и отдаёт адрес", async () => {
    const result = await check(signer.sign(googleClaims()));
    expect(result).toEqual({ ok: true, identity: { sub: "110000000000000000001", email: "justi@gmail.com" } });
  });

  it("iss без https тоже принят (Google выдаёт оба вида)", async () => {
    expect((await check(signer.sign(googleClaims({ iss: "accounts.google.com" })))).ok).toBe(true);
  });

  it.each([
    ["чужой aud", googleClaims({ aud: "other-app.apps.googleusercontent.com" }), "wrong_audience"],
    ["aud массивом с чужим клиентом", googleClaims({ aud: [AUD, "other"] }), "wrong_audience"],
    ["истёк", googleClaims({ exp: Math.floor(Date.now() / 1000) - 120 }), "expired"],
    ["без exp", googleClaims({ exp: undefined }), "expired"],
    ["выдан в будущем", googleClaims({ iat: Math.floor(Date.now() / 1000) + 3600 }), "issued_in_future"],
    ["чужой издатель", googleClaims({ iss: "https://evil.example" }), "bad_issuer"],
    ["не тот nonce", googleClaims({ nonce: "nonce-2" }), "nonce_mismatch"],
    ["без nonce", googleClaims({ nonce: undefined }), "nonce_mismatch"],
    ["адрес не подтверждён", googleClaims({ email_verified: false }), "email_unverified"],
    ["подтверждение не указано", googleClaims({ email_verified: undefined }), "email_unverified"],
    ["без адреса", googleClaims({ email: undefined }), "no_email"],
  ])("отвергает: %s", async (_name, claims, error) => {
    expect(await check(signer.sign(claims))).toEqual({ ok: false, error });
  });

  it("отвергает подпись чужим ключом с тем же kid", async () => {
    expect(await check(other.sign(googleClaims()))).toEqual({ ok: false, error: "bad_signature" });
  });

  it("отвергает подменённое тело при настоящей подписи", async () => {
    const [h, , s] = signer.sign(googleClaims()).split(".");
    const forged = Buffer.from(JSON.stringify(googleClaims({ email: "victim@gmail.com" }))).toString("base64url");
    expect(await check(`${h}.${forged}.${s}`)).toEqual({ ok: false, error: "bad_signature" });
  });

  it("отвергает неизвестный kid и alg none", async () => {
    expect(await check(signer.sign(googleClaims(), { kid: "nope" }))).toEqual({ ok: false, error: "unknown_key" });
    expect(await check(signer.sign(googleClaims(), { alg: "none" }))).toEqual({ ok: false, error: "bad_algorithm" });
  });

  it("пустой nonce у вызывающего — отказ, даже если в токене тоже пусто", async () => {
    expect(await check(signer.sign(googleClaims({ nonce: "" })), "")).toEqual({ ok: false, error: "nonce_mismatch" });
  });

  it("мусор вместо токена", async () => {
    expect(await check("abc")).toEqual({ ok: false, error: "malformed" });
    expect(await check("a.b.c")).toEqual({ ok: false, error: "malformed" });
  });
});
