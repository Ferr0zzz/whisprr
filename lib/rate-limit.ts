import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const requests = new Map<string, RateLimitEntry>();
const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

export async function checkRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Date.now();
  const key = `${scope}:${getClientIp(request)}`;

  if (redis) {
    const redisKey = `whisprr:rate:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, Math.ceil(windowMs / 1000));
    }
    return {
      allowed: count <= limit,
      retryAfter: Math.ceil(windowMs / 1000),
    };
  }

  const current = requests.get(key);

  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;
  return {
    allowed: current.count <= limit,
    retryAfter: Math.ceil((current.resetAt - now) / 1000),
  };
}
