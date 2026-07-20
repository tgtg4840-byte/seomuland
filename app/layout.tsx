import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  const description = "급여, 급여 RPA, 기관계좌, 사무용품, 수합명단, 여비, 특근매식비 업무 도구를 한곳에서 실행하고 관리하세요.";

  return {
    title: "서무랜드 — 서무업무 허브",
    description,
    openGraph: {
      title: "서무랜드 — 오늘도, 서무는 가볍게.",
      description,
      type: "website",
      locale: "ko_KR",
      images: [{ url: imageUrl, width: 1536, height: 1024, alt: "서무랜드 서무업무 허브" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "서무랜드 — 오늘도, 서무는 가볍게.",
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
