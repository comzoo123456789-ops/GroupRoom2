import { useState } from "react";
import type { RoomKind, RoomLive } from "../../shared/types";
import { api } from "../lib/api";
import { minToHHMM } from "../lib/time";

const toMin = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const COLORS = [
  "#3B5BDB", "#0CA678", "#7048E8", "#F76707",
  "#1098AD", "#E8590C", "#E03131", "#495057",
];
const AMENITY_OPTS: { key: string; label: string }[] = [
  { key: "tv", label: "TV/모니터" },
  { key: "whiteboard", label: "화이트보드" },
  { key: "cam", label: "화상장비" },
];

export default function RoomEditor({
  room,
  onClose,
  onSaved,
}: {
  room: RoomLive | null; // null = 신규 생성
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !room;
  const [name, setName] = useState(room?.name ?? "");
  const [kind, setKind] = useState<RoomKind>(room?.kind ?? "meeting");
  const [capacity, setCapacity] = useState(room?.capacity ?? 4);
  const [color, setColor] = useState(room?.color ?? COLORS[0]);
  const [amenities, setAmenities] = useState<string[]>(room?.amenities ?? []);
  // 예약 규칙
  const [openT, setOpenT] = useState(minToHHMM(room?.policy?.openMin ?? 480));
  const [closeT, setCloseT] = useState(minToHHMM(room?.policy?.closeMin ?? 1320));
  const [maxDur, setMaxDur] = useState(room?.policy?.maxDurationMin ?? 0);
  const [maxAdv, setMaxAdv] = useState(room?.policy?.maxAdvanceDays ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleAmenity = (k: string) =>
    setAmenities((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const save = async () => {
    if (!name.trim()) {
      setErr("회의실 이름을 입력하세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (toMin(closeT) <= toMin(openT)) {
        setBusy(false);
        return setErr("운영 종료 시간이 시작보다 빨라요.");
      }
      const body = {
        name: name.trim(),
        kind,
        capacity,
        color,
        amenities,
        policy: {
          openMin: toMin(openT),
          closeMin: toMin(closeT),
          maxDurationMin: maxDur,
          maxAdvanceDays: maxAdv,
        },
        ...(isNew ? { plan: { x: 38, y: 40, w: 22, h: 18 } } : {}),
      };
      if (isNew) await api.createRoom(body);
      else await api.updateRoom(room!.id, body);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!room) return;
    if (!confirm(`'${room.name}' 회의실을 삭제할까요? 관련 예약도 함께 삭제됩니다.`)) return;
    setBusy(true);
    try {
      await api.deleteRoom(room.id);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "삭제 실패");
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isNew ? "회의실 추가" : "회의실 수정"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="field">
          <label>이름</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 회의실 A"
            autoFocus
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label>유형</label>
            <div className="seg">
              <button className={kind === "meeting" ? "on" : ""} onClick={() => setKind("meeting")}>
                회의실
              </button>
              <button className={kind === "common" ? "on" : ""} onClick={() => setKind("common")}>
                공용공간
              </button>
            </div>
          </div>
          <div className="field" style={{ maxWidth: 120 }}>
            <label>수용 인원</label>
            <input
              type="number"
              min={1}
              max={500}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="field">
          <label>색상</label>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={"swatch" + (color === c ? " on" : "")}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <label>편의시설</label>
          <div className="chips">
            {AMENITY_OPTS.map((a) => (
              <button
                key={a.key}
                className={"chip" + (amenities.includes(a.key) ? " on" : "")}
                onClick={() => toggleAmenity(a.key)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rule-sep">예약 규칙</div>
        <div className="field-row">
          <div className="field">
            <label>운영 시작</label>
            <input type="time" step={1800} className="select" value={openT} onChange={(e) => setOpenT(e.target.value)} />
          </div>
          <div className="field">
            <label>운영 종료</label>
            <input type="time" step={1800} className="select" value={closeT} onChange={(e) => setCloseT(e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>최대 이용시간</label>
            <select className="select" value={maxDur} onChange={(e) => setMaxDur(Number(e.target.value))}>
              <option value={0}>무제한</option>
              <option value={30}>30분</option>
              <option value={60}>1시간</option>
              <option value={90}>1시간 30분</option>
              <option value={120}>2시간</option>
              <option value={180}>3시간</option>
              <option value={240}>4시간</option>
            </select>
          </div>
          <div className="field">
            <label>사전예약 최대 (일)</label>
            <input
              type="number"
              min={0}
              max={365}
              value={maxAdv}
              onChange={(e) => setMaxAdv(Number(e.target.value))}
              placeholder="0 = 무제한"
            />
          </div>
        </div>

        {err && <div className="auth-err" style={{ marginTop: 4 }}>{err}</div>}

        <div className="modal-foot">
          {!isNew && (
            <button className="btn btn-ghost danger" onClick={del} disabled={busy}>
              삭제
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
