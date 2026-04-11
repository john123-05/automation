import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(145deg, #101214 0%, #171c21 48%, #202934 100%)",
          borderRadius: 42,
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 12,
            borderRadius: 32,
            border: "1px solid rgba(255,255,255,0.14)",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            transform: "translateY(2px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              color: "#f6f1e8",
              fontWeight: 700,
              lineHeight: 0.9,
            }}
          >
            <span style={{ fontSize: 58 }}>L</span>
            <span style={{ fontSize: 58 }}>M</span>
          </div>
          <div
            style={{
              display: "flex",
              padding: "4px 10px",
              borderRadius: 999,
              background: "#f6f1e8",
              color: "#111418",
              fontSize: 12,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Leads
          </div>
        </div>
      </div>
    ),
    size,
  );
}
