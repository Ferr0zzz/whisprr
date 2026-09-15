export interface StoredSecret {
    ciphertext: string;
    iv: string;
    createdAt: number;
    expiresAt: number;
    burnAfterRead: boolean;
    consumed: boolean;
}

export interface CreateSecretRequest {
    ciphertext: string;
    iv: string;
    ttlMinutes: number;
    burnAfterRead: boolean;
}

export interface CreateSecretResponse {
    id: string;
}