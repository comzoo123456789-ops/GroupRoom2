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

// --- 임의 날짜 지원 (미리 예약) ---
/** 해당 시각이 속한 날의 00:00 epoch(ms) */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
/** 특정 날짜의 [00:00, 다음날 00:00] 범위 */
export function dayRange(ms: number): [number, number] {
  const s = startOfDay(ms);
  return [s, s + 86_400_000];
}
/** 특정 날짜 00:00 기준 분 → epoch(ms) */
export function minToTs(dayStart: number, min: number): number {
  return dayStart + min * 60_000;
}
/** "HH:MM"을 특정 날짜의 epoch(ms)로 */
export function hhmmToTs(dayStart: number, t: string): number {
  const [h, m] = t.split(":").map(Number);
  return dayStart + (h * 60 + m) * 60_000;
}
export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}
/** <input type="date"> 값 (YYYY-MM-DD) */
export function dateInputValue(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** YYYY-MM-DD → 그 날 00:00 epoch(ms) */
export function dateFromInput(v: string): number {
  const [y, m, dd] = v.split("-").map(Number);
  const d = new Date();
  d.setFullYear(y, m - 1, dd);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
/** "M월 D일 (요일)" */
export function dayLabel(ms: number): string {
  const d = new Date(ms);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

// --- 주간 뷰 ---
/** ms가 속한 주의 월요일 00:00 */
export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms));
  const day = d.getDay(); // 0=일..6=토
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); // 월요일로 이동
  return d.getTime();
}
/** 주 범위 [월 00:00, 다음주 월 00:00] */
export function weekRange(ms: number): [number, number] {
  const s = startOfWeek(ms);
  return [s, s + 7 * 86_400_000];
}
/** 그 주의 7개 날짜(각 00:00) */
export function weekDays(ms: number): number[] {
  const s = startOfWeek(ms);
  return Array.from({ length: 7 }, (_, i) => s + i * 86_400_000);
}
/** "7.28 ~ 8.3" */
export function weekLabel(ms: number): string {
  const s = startOfWeek(ms);
  const e = s + 6 * 86_400_000;
  const f = (x: number) => {
    const d = new Date(x);
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };
  return `${f(s)} ~ ${f(e)}`;
}
