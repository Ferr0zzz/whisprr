"use client";

import { use, useState } from "react";
import { importKey, decryptText } from "@/lib/crypto";

type SecretStatus = "ready" | "reading" | "read" | "expired" | "error";

export default function ViewSecretPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SecretStatus>("ready");
  const { id } = use(params);

  async function reveal() {
    setStatus("reading");
    const keyBase64 = window.location.hash.slice(1);
    if (!keyBase64) {
      setError("Clé de déchiffrement manquante dans le lien.");
      setStatus("error");
      return;
    }

    let res: Response;
    try {
      res = await fetch(`/api/secrets/${id}`);
    } catch {
      setError("Impossible de contacter le serveur. Réessaie dans un instant.");
      setStatus("error");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Ce lien n'est plus disponible.");
      setStatus(data?.code === "expired" ? "expired" : data?.code === "consumed" ? "read" : "error");
      return;
    }

    const { ciphertext, iv } = await res.json();

    try {
      const key = await importKey(keyBase64);
      const plaintext = await decryptText(ciphertext, iv, key);
      setContent(plaintext);
      setStatus("read");
    } catch {
      setError("Impossible de déchiffrer (clé invalide).");
      setStatus("error");
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px", fontFamily: "sans-serif", color: "#172033" }}>
      <h1 style={{ marginBottom: 8 }}>🔥 Whisprr</h1>
      <p style={{ color: "#506078" }}>Consultation sécurisée d&apos;un message chiffré.</p>

      {status === "ready" && (
        <>
          <div style={{ border: "1px solid #b9e5ce", borderRadius: 12, padding: 16, background: "#f2fff7" }}>
            <strong>🔒 Message chiffré</strong>
            <p>Le contenu sera déchiffré uniquement dans ton navigateur. Le lien sera marqué comme lu après cette action.</p>
            <button onClick={reveal} style={{ padding: "10px 16px", border: 0, borderRadius: 8, background: "#172033", color: "white", cursor: "pointer" }}>Révéler le secret</button>
          </div>
        </>
      )}

      {status === "reading" && <p role="status">Déchiffrement en cours...</p>}
      {error && <p role="alert" style={{ color: "#b42318", background: "#fff1f0", padding: 12, borderRadius: 8 }}>{error}</p>}
      {content && (
        <>
          <p><strong>Statut : </strong><span style={{ color: "#147a43" }}>● Lu et détruit</span></p>
          <p>Le contenu a été déchiffré localement. Le serveur ne conserve plus ce secret.</p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f4f4f4", padding: 12, borderRadius: 8 }}>
            {content}
          </pre>
        </>
      )}
      {status === "expired" && <p><strong>Statut : </strong><span style={{ color: "#b54708" }}>● Expiré</span></p>}
      {status === "read" && !content && <p><strong>Statut : </strong><span style={{ color: "#667085" }}>● Déjà lu</span></p>}
    </main>
  );
}