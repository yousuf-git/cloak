import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE } from "@/constants/site";

export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const logoBuffer = await readFile(join(process.cwd(), "public", "logo.png"));
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#fafaf9",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle left accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            background: "#1a3a2f",
            display: "flex",
          }}
        />

        {/* Soft radial atmosphere — no neon */}
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -160,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: "rgba(26, 58, 47, 0.05)",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "72px 80px 72px 88px",
            gap: 48,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
              maxWidth: 680,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                marginBottom: 36,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt=""
                width={64}
                height={64}
                style={{ borderRadius: 9999 }}
              />
              <span
                style={{
                  fontSize: 44,
                  fontWeight: 400,
                  color: "#111110",
                  letterSpacing: "-0.03em",
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}
              >
                Cloak
              </span>
            </div>

            <div
              style={{
                fontSize: 52,
                fontWeight: 600,
                color: "#111110",
                letterSpacing: "-0.035em",
                lineHeight: 1.12,
                marginBottom: 24,
              }}
            >
              Secrets that never leave your machine.
            </div>

            <div
              style={{
                fontSize: 22,
                color: "#5c5c57",
                lineHeight: 1.45,
                maxWidth: 560,
              }}
            >
              Zero-knowledge desktop vault for credentials, API keys, and encrypted .env files.
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 36,
                gap: 20,
                fontSize: 16,
                color: "#8a8a84",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.02em",
              }}
            >
              <span>Windows</span>
              <span>·</span>
              <span>macOS</span>
              <span>·</span>
              <span>Linux</span>
              <span>·</span>
              <span>MIT</span>
            </div>
          </div>

          {/* Large logo mark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 340,
              height: 340,
              flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt=""
              width={300}
              height={300}
              style={{ borderRadius: 9999 }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
