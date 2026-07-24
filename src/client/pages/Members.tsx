import { useEffect, useState } from "react";
import type { Member, Role, UserStatus } from "../../shared/types";
import { api } from "../lib/api";
import { IconUsers, IconSearch, IconPlus } from "../components/icons";
import "./Members.css";

const LIMIT = 24;
const initials = (name: string) => name.trim().slice(-2);

const ROLE_LABEL: Record<Role, string> = { admin: "관리자", member: "멤버" };
const STATUS_LABEL: Record<UserStatus, string> = {
  active: "활성",
  invited: "초대됨",
  inactive: "비활성",
};

export default function Members() {
  const [role, setRoleFilter] = useState<Role | "">("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [q, setQ] = useState("");

  const [items, setItems] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState<{ name: string; n: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    api
      .myRole()
      .then((r) => {
        setIsAdmin(r.role === "admin");
        setMeId(r.userId);
      })
      .catch(() => {});
  }, []);

  // 필터/검색 변경 시 첫 페이지 로드 (검색은 디바운스)
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const t = setTimeout(
      () => {
        api
          .memberList({ q, dept, role, status, limit: LIMIT, offset: 0 })
          .then((r) => {
            if (cancel) return;
            setItems(r.members);
            setTotal(r.total);
            setDepartments(r.departments);
          })
          .catch(() => {})
          .finally(() => !cancel && setLoading(false));
      },
      q ? 250 : 0,
    );
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [q, dept, role, status]);

  const reload = () => {
    api
      .memberList({ q, dept, role, status, limit: Math.max(LIMIT, items.length), offset: 0 })
      .then((r) => {
        setItems(r.members);
        setTotal(r.total);
        setDepartments(r.departments);
      })
      .catch(() => {});
  };

  const loadMore = () => {
    setLoadingMore(true);
    api
      .memberList({ q, dept, role, status, limit: LIMIT, offset: items.length })
      .then((r) => setItems((prev) => [...prev, ...r.members]))
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const changeRole = (m: Member, newRole: Role) => {
    api
      .updateMember(m.id, { role: newRole })
      .then(() => setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, role: newRole } : x))))
      .catch((e) => alert(e instanceof Error ? e.message : "변경 실패"));
  };
  const changeStatus = (m: Member, newStatus: UserStatus) => {
    api
      .updateMember(m.id, { status: newStatus })
      .then(() => {
        // 상태 필터가 걸려 있으면 목록에서 제외, 아니면 갱신
        if (status && status !== newStatus) {
          setItems((prev) => prev.filter((x) => x.id !== m.id));
          setTotal((t) => Math.max(0, t - 1));
        } else {
          setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: newStatus } : x)));
        }
      })
      .catch((e) => alert(e instanceof Error ? e.message : "변경 실패"));
  };

  return (
    <div className="mbr">
      <div className="mbr-head">
        <div className="mbr-title">
          <h2>멤버</h2>
          <span className="mbr-total">{total.toLocaleString()}명</span>
        </div>
        <div className="mbr-search">
          <IconSearch size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름·부서·이메일 검색"
          />
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <IconPlus size={16} /> 멤버 추가
          </button>
        )}
      </div>

      {/* 필터 */}
      <div className="mbr-filters">
        <div className="chip-row">
          <button className={"chip" + (dept === "" ? " on" : "")} onClick={() => setDept("")}>
            전체 부서
          </button>
          {departments.map((d) => (
            <button
              key={d.name}
              className={"chip" + (dept === d.name ? " on" : "")}
              onClick={() => setDept(dept === d.name ? "" : d.name)}
            >
              {d.name}
              <span className="chip-n">{d.n}</span>
            </button>
          ))}
        </div>
        <div className="mbr-filter-right">
          <select
            className="select mbr-sel"
            value={role}
            onChange={(e) => setRoleFilter(e.target.value as Role | "")}
          >
            <option value="">역할 전체</option>
            <option value="admin">관리자</option>
            <option value="member">멤버</option>
          </select>
          {isAdmin && (
            <select
              className="select mbr-sel"
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatus | "")}
            >
              <option value="">상태 전체</option>
              <option value="active">활성</option>
              <option value="invited">초대됨</option>
              <option value="inactive">비활성</option>
            </select>
          )}
        </div>
      </div>

      {/* 목록 */}
      <div className="mbr-list card">
        <div className="mbr-row mbr-rowhead">
          <span>이름</span>
          <span className="col-dept">부서</span>
          <span className="col-email">이메일</span>
          <span className="col-role">역할</span>
          <span className="col-status">상태</span>
          {isAdmin && <span className="col-act" />}
        </div>

        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div className="mbr-row mbr-skel" key={i}>
              <span className="sk sk-ava" />
              <span className="sk sk-line" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="mbr-empty">
            <IconUsers size={28} />
            <p>조건에 맞는 멤버가 없어요</p>
          </div>
        ) : (
          items.map((m) => (
            <div className={"mbr-row" + (m.status === "inactive" ? " off" : "")} key={m.id}>
              <span className="col-name">
                <span className="mbr-ava" style={{ background: m.avatarColor }}>
                  {initials(m.name)}
                </span>
                <span className="mbr-name-txt">
                  {m.name}
                  {m.id === meId && <em className="mbr-me">나</em>}
                </span>
              </span>
              <span className="col-dept">{m.department ?? "—"}</span>
              <span className="col-email">{m.email}</span>
              <span className="col-role">
                <span className={"rolebadge " + m.role}>{ROLE_LABEL[m.role]}</span>
              </span>
              <span className="col-status">
                <span className={"statusbadge " + m.status}>{STATUS_LABEL[m.status]}</span>
              </span>
              {isAdmin && (
                <span className="col-act">
                  {m.role === "admin" ? (
                    <button className="mini" onClick={() => changeRole(m, "member")}>
                      멤버로
                    </button>
                  ) : (
                    <button className="mini" onClick={() => changeRole(m, "admin")}>
                      관리자로
                    </button>
                  )}
                  {m.status === "active" ? (
                    <button className="mini danger" onClick={() => changeStatus(m, "inactive")}>
                      비활성
                    </button>
                  ) : (
                    <button className="mini" onClick={() => changeStatus(m, "active")}>
                      활성화
                    </button>
                  )}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {!loading && items.length < total && (
        <div className="mbr-more">
          <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "불러오는 중…" : `더 보기 (${items.length} / ${total})`}
          </button>
        </div>
      )}

      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function AddMemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; pw: string } | null>(null);

  const save = async () => {
    if (!name.trim() || !email.trim()) return setErr("이름과 이메일을 입력하세요.");
    setBusy(true);
    setErr(null);
    try {
      const r = await api.createMember({ name: name.trim(), email: email.trim(), department, role });
      setDone({ email: email.trim(), pw: r.tempPassword });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "추가 실패");
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>멤버 추가</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        {done ? (
          <>
            <p className="muted" style={{ lineHeight: 1.6 }}>
              <b>{done.email}</b> 계정이 생성됐습니다. 아래 임시 비밀번호를 전달하세요. 첫 로그인 시
              비밀번호 변경이 권장됩니다.
            </p>
            <div className="mbr-pw">{done.pw}</div>
            <div className="modal-foot">
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={onSaved}>완료</button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label>이름</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" autoFocus />
            </div>
            <div className="field">
              <label>이메일</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                type="email"
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>부서</label>
                <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="개발팀" />
              </div>
              <div className="field">
                <label>역할</label>
                <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="member">멤버</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
            </div>
            {err && <div className="auth-err" style={{ marginTop: 4 }}>{err}</div>}
            <div className="modal-foot">
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={onClose} disabled={busy}>취소</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "추가 중…" : "추가"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
