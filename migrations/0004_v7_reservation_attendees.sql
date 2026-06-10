-- ========================================================================
-- V7 고도화 최종본 — 다대다(M:N) 참석자 매핑 테이블
-- 한 건의 예약(reservations)에 여러 명의 멤버(users)가 참석자로 초대될 수
-- 있도록 reservation_attendees 정규화 테이블 신설.
-- 초대 상태: PENDING / ACCEPTED / DECLINED
-- ========================================================================

CREATE TABLE IF NOT EXISTS reservation_attendees (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id  INTEGER NOT NULL,
  member_id       INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  invited_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at    DATETIME,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id)      REFERENCES users(id)        ON DELETE CASCADE,
  UNIQUE (reservation_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_resv_attendees_member
  ON reservation_attendees (member_id, status);

CREATE INDEX IF NOT EXISTS idx_resv_attendees_reservation
  ON reservation_attendees (reservation_id);
