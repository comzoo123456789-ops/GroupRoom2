// 타임테이블 시간 범위 (요청: 08:00 ~ 22:00)
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 22;
export const HOUR_PX = 56; // 1시간 높이(px)
export const SNAP_MIN = 30; // 예약 스냅 단위(분)

/** 오늘 날짜의 특정 시(hour, 분)에 해당하는 epoch(ms) */
export function todayAt(hour: number, minute = 0): number {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/** 오늘 00:00 ~ 24:00 범위 [from, to] */
export function todayRange(): [number, number] {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return [from.getTime(), to.getTime()];
}

/** epoch(ms) → 08:00 기준 상단 오프셋(px). 범위 밖은 클램프 */
export function tsToTop(ts: number): number {
  const d = new Date(ts);
  const h = d.getHours() + d.getMinutes() / 60;
  const clamped = Math.min(DAY_END_HOUR, Math.max(DAY_START_HOUR, h));
  return (clamped - DAY_START_HOUR) * HOUR_PX;
}

export function hhmm(ts: number): string {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "HH:MM" 문자열 목록 (08:00 ~ 22:00, SNAP_MIN 간격) */
export function timeOptions(): string[] {
  const out: string[] = [];
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SNAP_MIN) {
      if (h === DAY_END_HOUR && m > 0) break;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

/** "HH:MM" → 오늘 epoch(ms) */
export function hhmmToday(hhmmStr: string): number {
  const [h, m] = hhmmStr.split(":").map(Number);
  return todayAt(h, m);
}

// --- 분(minute) 단위 드래그 계산 헬퍼 ---
const pad = (n: number) => String(n).padStart(2, "0");

/** 08:00 기준 분 → 상단 오프셋(px) */
export function minToTop(min: number): number {
  return (min / 60 - DAY_START_HOUR) * HOUR_PX;
}
/** 분 → "HH:MM" */
export function minToHHMM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
/** 분 → 오늘 epoch(ms) */
export function minToday(min: number): number {
  return todayAt(Math.floor(min / 60), min % 60);
}
/** epoch(ms) → 자정 기준 분 */
export function tsToMin(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}
export function snapMin(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}
export function clampMin(min: number): number {
  return Math.min(DAY_END_HOUR * 60, Math.max(DAY_START_HOUR * 60, min));
}
