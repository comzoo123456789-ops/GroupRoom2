import type { Env } from "../types";

// Cloudflare Email Sending (send_email 바인딩) 래퍼.
// 발송 도메인이 온보딩되지 않았거나 바인딩이 없으면 조용히 no-op → 예약 흐름은 절대 깨지지 않음.

export interface OutMsg {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(env: Env, msg: OutMsg): Promise<boolean> {
  if (!env.EMAIL || typeof env.EMAIL.send !== "function") return false;
  const from = env.EMAIL_FROM || "no-reply@example.com"; // ← 온보딩된 도메인으로 교체
  try {
    await env.EMAIL.send({
      to: msg.to,
      from: { email: from, name: "Wylie Meeting" },
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    return true;
  } catch {
    // 도메인 미인증/일시 오류 등 — 앱 흐름에 영향 주지 않음
    return false;
  }
}

const KST = {
  timeZone: "Asia/Seoul" as const,
  hour12: false as const,
};

/** "7월 30일 (수) 14:00 ~ 15:00" (KST) */
export function whenLabel(startsAt: number, endsAt: number): string {
  const day = new Date(startsAt).toLocaleString("ko-KR", {
    ...KST,
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const t = (ms: number) =>
    new Date(ms).toLocaleString("ko-KR", { ...KST, hour: "2-digit", minute: "2-digit" });
  return `${day} ${t(startsAt)} ~ ${t(endsAt)}`;
}

/** 공통 이메일 템플릿 (제목 + 정보 줄들 + CTA) */
export function template(
  heading: string,
  rows: { label: string; value: string }[],
  note?: string,
): { html: string; text: string } {
  const brand = "#703B96";
  const text =
    `${heading}\n\n` +
    rows.map((r) => `${r.label}: ${r.value}`).join("\n") +
    (note ? `\n\n${note}` : "") +
    `\n\n— Wylie Meeting`;
  const html = `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#f5f6f8;padding:28px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e7e9ee;border-radius:16px;overflow:hidden">
      <div style="background:${brand};padding:18px 24px;color:#fff;font-weight:700;font-size:16px">Wylie Meeting</div>
      <div style="padding:24px">
        <h2 style="margin:0 0 16px;font-size:19px;color:#14161c">${heading}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${rows
            .map(
              (r) =>
                `<tr><td style="padding:6px 0;color:#8a92a3;width:88px">${r.label}</td><td style="padding:6px 0;color:#14161c;font-weight:600">${r.value}</td></tr>`,
            )
            .join("")}
        </table>
        ${note ? `<p style="margin:16px 0 0;color:#59606f;font-size:13px;line-height:1.6">${note}</p>` : ""}
      </div>
      <div style="padding:14px 24px;border-top:1px solid #eee;color:#b0b6c0;font-size:12px">Wylie Meeting · 사내 회의실 예약</div>
    </div>
  </div>`;
  return { html, text };
}
