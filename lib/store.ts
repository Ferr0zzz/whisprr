import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";
import { StoredSecret } from "@/types";

/**
 * Abstraction de stockage.
 *
 * En dev : une Map en mémoire (suffisant pour tester en local).
 * En prod (Jour 3) : on remplacera InMemoryStore par une implémentation
 * Vercel KV / Upstash Redis qui respecte la même interface — le reste
 * de l'app (routes API, pages) n'aura RIEN à changer.
 */
interface SecretStore {
  save(secret: Omit<StoredSecret, "createdAt" | "consumed">): Promise<string>;
  get(id: string): Promise<StoredSecret | null>;
  consume(id: string): Promise<StoredSecret | null>;
  delete(id: string): Promise<void>;
  markRead(id: string): Promise<void>;
  status(id: string): Promise<"available" | "consumed" | "expired" | "missing">;
}

class InMemoryStore implements SecretStore {
  private map = new Map<string, StoredSecret>();
  private terminalStatuses = new Map<string, "consumed" | "expired">();

  async save(secret: Omit<StoredSecret, "createdAt" | "consumed">) {
    const id = randomUUID();
    this.map.set(id, { ...secret, createdAt: Date.now(), consumed: false });
    return id;
  }

  async get(id: string) {
    const secret = this.map.get(id);
    if (!secret) return null;

    if (Date.now() > secret.expiresAt) {
      this.map.delete(id);
      this.terminalStatuses.set(id, "expired");
      return null;
    }
    return secret;
  }

  async consume(id: string) {
    const secret = await this.get(id);
    if (!secret) return null;
    if (secret.burnAfterRead) {
      await this.delete(id);
    } else {
      await this.markRead(id);
    }
    return secret;
  }

  async delete(id: string) {
    this.map.delete(id);
    this.terminalStatuses.set(id, "consumed");
  }

  async markRead(id: string) {
    const secret = this.map.get(id);
    if (secret) {
      secret.consumed = true;
    }
  }

  async status(id: string) {
    const secret = this.map.get(id);
    if (secret) {
      if (Date.now() > secret.expiresAt) {
        this.map.delete(id);
        this.terminalStatuses.set(id, "expired");
        return "expired";
      }
      return secret.consumed ? "consumed" : "available";
    }
    return this.terminalStatuses.get(id) ?? "missing";
  }
}

class RedisStore implements SecretStore {
  private readonly redis: Redis;
  private readonly prefix = "whisprr:secret:";
  private readonly statusRetentionSeconds = 24 * 60 * 60;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private key(id: string) {
    return `${this.prefix}${id}`;
  }

  private statusKey(id: string) {
    return `${this.key(id)}:status`;
  }

  async save(secret: Omit<StoredSecret, "createdAt" | "consumed">) {
    const id = randomUUID();
    const value = { ...secret, createdAt: Date.now(), consumed: false };
    const ttlSeconds = Math.max(1, Math.ceil((secret.expiresAt - Date.now()) / 1000));
    await this.redis.set(this.key(id), value, { ex: ttlSeconds });
    await this.redis.set(this.statusKey(id), "available", { ex: ttlSeconds });
    return id;
  }

  async get(id: string) {
    const secret = await this.redis.get<StoredSecret>(this.key(id));
    if (!secret) return null;
    if (Date.now() > secret.expiresAt) {
      await this.redis.set(this.statusKey(id), "expired", { ex: this.statusRetentionSeconds });
      return null;
    }
    return secret;
  }

  async consume(id: string) {
    const secret = await this.get(id);
    if (!secret) return null;
    if (secret.burnAfterRead) {
      const consumed = await this.redis.getdel<StoredSecret>(this.key(id));
      if (!consumed) return null;
      await this.redis.set(this.statusKey(id), "consumed", { ex: this.statusRetentionSeconds });
      return consumed;
    }
    await this.markRead(id);
    return secret;
  }

  async delete(id: string) {
    await this.redis.del(this.key(id));
    await this.redis.set(this.statusKey(id), "consumed", { ex: this.statusRetentionSeconds });
  }

  async markRead(id: string) {
    const secret = await this.get(id);
    if (secret) {
      await this.redis.set(this.key(id), { ...secret, consumed: true }, {
        ex: Math.max(1, Math.ceil((secret.expiresAt - Date.now()) / 1000)),
      });
    }
  }

  async status(id: string) {
    const secret = await this.get(id);
    if (secret) return secret.consumed ? "consumed" : "available";
    return (await this.redis.get<"consumed" | "expired">(this.statusKey(id))) ?? "missing";
  }
}

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const store: SecretStore =
  redisUrl && redisToken
    ? new RedisStore(new Redis({ url: redisUrl, token: redisToken }))
    : new InMemoryStore();
