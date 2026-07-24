import type { ReactNode } from "react";
import { IconCalendar } from "../components/icons";

export default function Timeline() {
  return (
    <ComingSoon
      icon={<IconCalendar size={28} />}
      title="예약 타임라인"
      desc="드래그로 예약 생성·이동·리사이즈, 반복 예약, 참석자 초대를 지원하는 일간/주간 타임라인이 여기에 들어갑니다."
      items={["드래그 예약 (10분 스냅)", "충돌 실시간 검증", "반복 예약", "참석자 초대·응답"]}
    />
  );
}

export function ComingSoon({
  icon,
  title,
  desc,
  items,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  items: string[];
}) {
  return (
    <div className="card" style={{ padding: 48, textAlign: "center" }}>
      <div
        className="brand-mark"
        style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 16 }}
      >
        {icon}
      </div>
      <h2 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>{title}</h2>
      <p className="muted" style={{ maxWidth: 460, margin: "10px auto 0", lineHeight: 1.6 }}>
        {desc}
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginTop: 24,
        }}
      >
        {items.map((it) => (
          <span key={it} className="badge" style={{ background: "var(--brand-wash)", color: "var(--brand-ink)", height: 28 }}>
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
