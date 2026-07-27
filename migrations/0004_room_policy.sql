-- 회의실별 예약 규칙(정책). 각 회의실이 자기 규칙 1세트를 가진다.
ALTER TABLE rooms ADD COLUMN open_min INTEGER NOT NULL DEFAULT 480;        -- 운영 시작(분, 480=08:00)
ALTER TABLE rooms ADD COLUMN close_min INTEGER NOT NULL DEFAULT 1320;      -- 운영 종료(분, 1320=22:00)
ALTER TABLE rooms ADD COLUMN max_duration_min INTEGER NOT NULL DEFAULT 0;  -- 최대 이용시간(분, 0=무제한)
ALTER TABLE rooms ADD COLUMN max_advance_days INTEGER NOT NULL DEFAULT 0;  -- 사전예약 최대일수(0=무제한)
