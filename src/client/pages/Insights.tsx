import { useEffect, useState } from "react";
import type { Analytics } from "../../shared/types";
import { api } from "../lib/api";
import { IconChart } from "../components/icons";
import "./Insights.css";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const PERIODS = [
  { d: 7, label: "7일" },
  { d: 30, label: "30일" },
  { d: 90, label: "90일" },
];

export default function Insights() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .analytics(days)
      .then((d) => !cancel && setData(d))
      .catch(() => {})
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [days]);

  const maxHeat = data ? Math.max(1, ...data.heatmap.flat()) : 1;
  const maxRoomUtil = data ? Math.max(1, ...data.rooms.map((r) => r.utilizationPct)) : 1;
  const maxDept = data ? Math.max(1, ...data.departments.map((d) => d.count)) : 1;
  const maxDaily = data ? Math.max(1, ...data.daily.map((d) => d.count)) : 1;

  return (
    <div className="ins">
      <div className="ins-head">
        <div className="ins-title">
          <h2>이용 분석</h2>
          <span className="muted">회의실 운영 인사이트</span>
        </div>
        <div className="seg">
          {PERIODS.map((p) => (
            <button
              key={p.d}
              className={days === p.d ? "on" : ""}
              onClick={() => setDays(p.d)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="ins-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="kpi card sk-block" key={i} />
          ))}
        </div>
      ) : data.totals.reservations === 0 ? (
        <div className="card ins-empty">
          <IconChart size={28} />
          <p>이 기간에 집계할 예약이 없어요</p>
        </div>
      ) : (
        <>
          {/* KPI 타일 */}
          <div className="ins-grid">
            <Kpi label="총 예약" value={data.totals.reservations.toLocaleString()} unit="건" />
            <Kpi label="총 이용시간" value={data.totals.hours.toLocaleString()} unit="시간" />
            <Kpi label="평균 회의 길이" value={String(data.totals.avgDurationMin)} unit="분" />
            <Kpi label="평균 가동률" value={String(data.totals.utilizationPct)} unit="%" accent />
            <Kpi label="취소율" value={String(data.totals.cancelRate)} unit="%" />
          </div>

          <div className="ins-2col">
            {/* 회의실 가동률 */}
            <section className="card panel">
              <h3>회의실별 가동률</h3>
              <p className="panel-sub muted">영업일 · {data.hourStart}시–22시 기준</p>
              <div className="bars">
                {[...data.rooms]
                  .sort((a, b) => b.utilizationPct - a.utilizationPct)
                  .map((r) => (
                    <div className="bar-row" key={r.id} title={`${r.name} · ${r.count}건 · ${r.hours}시간`}>
                      <span className="bar-label has-dot" style={{ "--dot": r.color } as React.CSSProperties}>
                        {r.name}
                      </span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${(r.utilizationPct / maxRoomUtil) * 100}%` }}
                        />
                      </div>
                      <span className="bar-val">{r.utilizationPct}%</span>
                    </div>
                  ))}
              </div>
            </section>

            {/* 부서별 이용 */}
            <section className="card panel">
              <h3>부서별 이용</h3>
              <p className="panel-sub muted">예약 건수 기준 상위</p>
              <div className="bars">
                {data.departments.slice(0, 8).map((d) => (
                  <div className="bar-row" key={d.dept} title={`${d.dept} · ${d.hours}시간`}>
                    <span className="bar-label">{d.dept}</span>
                    <div className="bar-track">
                      <div className="bar-fill alt" style={{ width: `${(d.count / maxDept) * 100}%` }} />
                    </div>
                    <span className="bar-val">{d.count}건</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 요일×시간 히트맵 */}
          <section className="card panel">
            <h3>요일 × 시간 히트맵</h3>
            <p className="panel-sub muted">예약이 몰리는 시간대</p>
            <div className="heat">
              <div className="heat-hours">
                <span className="heat-corner" />
                {data.heatmap[0].map((_, h) => (
                  <span key={h} className="heat-hh">
                    {(h + data.hourStart) % 2 === 0 ? h + data.hourStart : ""}
                  </span>
                ))}
              </div>
              {data.heatmap.map((row, wd) => (
                <div className="heat-row" key={wd}>
                  <span className={"heat-wd" + (wd === 0 || wd === 6 ? " we" : "")}>{WD[wd]}</span>
                  {row.map((n, h) => (
                    <span
                      key={h}
                      className="heat-cell"
                      title={`${WD[wd]} ${h + data.hourStart}시 · ${n}건`}
                      style={{
                        background:
                          n === 0
                            ? "var(--surface-sunken)"
                            : `color-mix(in srgb, var(--brand) ${Math.round(
                                18 + (n / maxHeat) * 82,
                              )}%, var(--surface))`,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </section>

          {/* 일별 추이 */}
          <section className="card panel">
            <h3>일별 예약 추이</h3>
            <p className="panel-sub muted">최근 {days}일</p>
            <div className="trend">
              {data.daily.map((d) => (
                <div className="trend-col" key={d.date} title={`${d.date} · ${d.count}건 · ${d.hours}시간`}>
                  <div
                    className="trend-bar"
                    style={{ height: `${Math.max(2, (d.count / maxDaily) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="trend-axis">
              <span>{data.daily[0]?.date}</span>
              <span>{data.daily[data.daily.length - 1]?.date}</span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className={"kpi card" + (accent ? " accent" : "")}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">
        {value}
        <em>{unit}</em>
      </span>
    </div>
  );
}
