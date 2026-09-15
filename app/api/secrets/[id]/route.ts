import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await checkRateLimit(req, "read-secret", 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessaie dans quelques instants.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const { id } = await params;

  if (new URL(req.url).searchParams.get("status") === "1") {
    const status = await store.status(id);
    return NextResponse.json({ status });
  }

  const secret = await store.consume(id);

  if (!secret) {
    const status = await store.status(id);
    if (status === "consumed") {
      return NextResponse.json(
        { error: "Ce lien a déjà été lu et détruit.", code: "consumed" },
        { status: 410 }
      );
    }
    if (status === "expired") {
      return NextResponse.json(
        { error: "Ce lien a expiré.", code: "expired" },
        { status: 410 }
      );
    }
    return NextResponse.json(
      { error: "Ce secret est introuvable.", code: "missing" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ciphertext: secret.ciphertext,
    iv: secret.iv,
  });
}
