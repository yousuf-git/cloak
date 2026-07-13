import { ImageResponse } from "next/og";
import { SITE } from "@/constants/site";

export const runtime = "edge";
export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const logoData = await fetch(new URL("./icon.png", import.meta.url)).then((res) =>
    res.arrayBuffer(),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "linear-gradient(135deg, #f8faf9 0%, #ffffff 55%, #eef5f1 100%)",
          borderTop: "5px solid #1b4332",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoData as unknown as string}
            alt=""
            width={88}
            height={88}
            style={{ borderRadius: 20 }}
          />
          <span style={{ fontSize: 56, fontWeight: 700, color: "#081c15", letterSpacing: "-0.02em" }}>
            Cloak
          </span>
        </div>
        <p style={{ fontSize: 30, color: "#3d5a4c", lineHeight: 1.45, maxWidth: 900, margin: 0 }}>
          Zero-knowledge secrets vault for developers. Plaintext never leaves your machine.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 40,
            fontSize: 16,
            fontFamily: "monospace",
            color: "#1b4332",
          }}
        >
          <span style={{ padding: "8px 14px", border: "1px solid #b7d4c4", borderRadius: 6, background: "#f0f7f3" }}>
            AES-256-GCM
          </span>
          <span style={{ padding: "8px 14px", border: "1px solid #b7d4c4", borderRadius: 6, background: "#f0f7f3" }}>
            Zero-knowledge
          </span>
          <span style={{ padding: "8px 14px", border: "1px solid #b7d4c4", borderRadius: 6, background: "#f0f7f3" }}>
            Open source
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
