"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { generateKey, exportKey, encryptText } from "@/lib/crypto";

const emptySubscribe = () => () => {};

export default function CreateSecretPage() {
  const [text, setText] = useState("");
  const [ttl, setTtl] = useState(60);
  const [burnAfterRead, setBurnAfterRead] = useState(true);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<"available" | "consumed" | "expired" | "missing">("available");
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    if (!linkId || linkStatus !== "available") return;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/secrets/${linkId}?status=1`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setLinkStatus(data.status);
      } catch {
        // A temporary polling failure should not interrupt the creation flow.
      }
    };

    void checkStatus();
    const interval = window.setInterval(checkStatus, 3000);
    return () => window.clearInterval(interval);
  }, [linkId, linkStatus]);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    setCopyStatus(null);
    try {
      // 1. Chiffrement dans le navigateur. Rien de lisible ne part vers le serveur.
      const key = await generateKey();
      const { ciphertext, iv } = await encryptText(text, key);
      const exportedKey = await exportKey(key);

      // 2. On envoie uniquement le texte chiffré.
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciphertext, iv, ttlMinutes: ttl, burnAfterRead }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Impossible de créer le lien.");
        return;
      }

      // 3. La clé ne va JAMAIS au serveur : elle reste dans le fragment #
      //    de l'URL, que le navigateur ne transmet jamais en requête HTTP.
      const url = `${window.location.origin}/s/${data.id}#${exportedKey}`;
      setLink(url);
      setLinkId(data.id);
      setLinkStatus("available");

      try {
        await navigator.clipboard.writeText(url);
        setCopyStatus("copied");
      } catch {
        setCopyStatus("failed");
      }
    } catch {
      setError("Impossible de contacter le serveur. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px", fontFamily: "sans-serif", color: "#172033" }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 8 }}>🔥 Whisprr</h1>
        <p style={{ margin: 0, color: "#506078" }}>Partage un message secret, sans exposer son contenu au serveur.</p>
      </header>

      <section style={{ border: "1px solid #b9e5ce", borderRadius: 12, padding: 16, background: "#f2fff7", marginBottom: 20 }}>
        <strong>🔒 Chiffré de bout en bout</strong>
        <p style={{ margin: "8px 0 0", color: "#37604a" }}>
          Le message est chiffré dans ton navigateur. La clé reste dans le lien et le serveur ne voit jamais le texte en clair.
        </p>
      </section>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ton secret..."
        rows={6}
        style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #b9c3d1", resize: "vertical" }}
      />

      <div style={{ margin: "12px 0" }}>
        <label>
          Expiration (minutes) :
          <input
            type="number"
            value={ttl}
            onChange={(e) => setTtl(Number(e.target.value))}
            min={1}
            max={10080}
            style={{ marginLeft: 8, width: 80, padding: 6 }}
          />
        </label>
      </div>

      <div style={{ margin: "12px 0" }}>
        <label>
          <input
            type="checkbox"
            checked={burnAfterRead}
            onChange={(e) => setBurnAfterRead(e.target.checked)}
          />{" "}
          Auto-destruction après lecture
        </label>
      </div>

      <button onClick={handleCreate} disabled={hydrated && (loading || !text)} style={{ padding: "10px 16px", border: 0, borderRadius: 8, background: "#172033", color: "white", cursor: "pointer" }}>
        {loading ? "Chiffrement..." : "Créer le lien"}
      </button>

      {error && <p role="alert" style={{ color: "#b42318", background: "#fff1f0", padding: 12, borderRadius: 8 }}>{error}</p>}

      {link && (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid #b9c3d1", borderRadius: 10 }}>
          <p style={{ marginTop: 0 }}>
            <strong>Statut : </strong>
            {linkStatus === "available" && <span style={{ color: "#147a43" }}>● En attente de lecture</span>}
            {linkStatus === "consumed" && <span style={{ color: "#147a43" }}>● Lu par le destinataire</span>}
            {linkStatus === "expired" && <span style={{ color: "#b54708" }}>● Expiré</span>}
            {linkStatus === "missing" && <span style={{ color: "#667085" }}>● Indisponible</span>}
          </p>
          <strong>Lien chiffré à partager :</strong>
          <p style={{ wordBreak: "break-all", background: "#f5f7fa", padding: 10, borderRadius: 6 }}>{link}</p>
          {copyStatus === "copied" && <p role="status" style={{ color: "#147a43" }}>✓ Lien copié automatiquement dans le presse-papiers.</p>}
          {copyStatus === "failed" && (
            <p role="alert" style={{ color: "#b54708" }}>
              La copie automatique a été bloquée par le navigateur. Utilise le bouton ci-dessous ou copie le lien manuellement.
            </p>
          )}
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopyStatus("copied");
              } catch {
                setCopyStatus("failed");
              }
            }}
            style={{ padding: "8px 12px", border: "1px solid #b9c3d1", borderRadius: 8, background: "white", cursor: "pointer" }}
          >
            Copier le lien
          </button>
          <small>Ce lien sera détruit dès sa première lecture.</small>
        </div>
      )}
    </main>
  );
}
