-- V13: 예약 회의 목적 (purpose) 컬럼 추가
-- 사용자 요구: "일정 추가하는 팝업창에 목적 적어주고 어떤목적으로 회의하는지 타이핑 할 수 있게 만들어줘"
--             "인사이트에 내역에도 목적이 나오도록 보여주고, 엑셀 다운로드에도 목적이 나와야해"
ALTER TABLE reservations ADD COLUMN purpose TEXT;
