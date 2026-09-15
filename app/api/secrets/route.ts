import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";
import { CreateSecretRequest, CreateSecretResponse } from "@/types";

const MAX_TTL_MINUTES = 60 * 24 * 7; // 7 jours max
const RATE_LIMIT_WINDOW = 60_000;

export async function POST(req: NextRequest) {
  const rateLimit = await checkRateLimit(req, "create-secret", 10, RATE_LIMIT_WINDOW);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessaie dans quelques instants.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const body: CreateSecretRequest = await req.json();

  if (!body.ciphertext || !body.iv) {
    return NextResponse.json({ error: "ciphertext et iv requis" }, { status: 400 });
  }

  const ttlMinutes = Math.max(1, Math.min(body.ttlMinutes ?? 60, MAX_TTL_MINUTES));
  const expiresAt = Date.now() + ttlMinutes * 60_000;

  const id = await store.save({
    ciphertext: body.ciphertext,
    iv: body.iv,
    expiresAt,
    burnAfterRead: body.burnAfterRead ?? true,
  });

  const response: CreateSecretResponse = { id };
  return NextResponse.json(response, { status: 201 });
}
