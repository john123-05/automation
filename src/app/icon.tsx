import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
          position: "relative",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 28,
            borderRadius: 110,
            border: "2px solid rgba(255,255,255,0.12)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 70,
            left: 72,
            display: "flex",
            color: "rgba(255,255,255,0.22)",
            fontSize: 34,
            letterSpacing: 10,
            textTransform: "uppercase",
          }}
        >
          LM
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            transform: "translateY(6px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 20,
              color: "#f6f1e8",
              fontWeight: 700,
              lineHeight: 0.9,
            }}
          >
            <span style={{ fontSize: 164 }}>L</span>
            <span style={{ fontSize: 164 }}>M</span>
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 22px",
              borderRadius: 999,
              background: "#f6f1e8",
              color: "#111418",
              fontSize: 34,
              letterSpacing: 7,
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
