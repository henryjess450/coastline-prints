import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the placeholder wave mark on the brand navy. Replace with the real logo. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#0e4471", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="130" height="130" viewBox="0 0 32 32">
          <path d="M5 17c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0 2.2 2 2.2 2" stroke="#ffffff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M7 22.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0 3.6-1.5 5.4 0" stroke="#86bbea" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="21.5" cy="10" r="3" fill="#e9c46a" />
        </svg>
      </div>
    ),
    size,
  );
}
