-- V11 §3-3: 테넌트별 일정 색상 컬럼 추가
-- 기존 tenants.color는 브랜드 색상 의미였으나, 일정(예약 블록) 전용 컬러는 별도 컬럼으로 분리하여
-- 와일리(WYLIE)와 러쉬코리아(LUSH) 일정 색상이 완전히 독립적으로 관리되도록 함.

ALTER TABLE tenants ADD COLUMN schedule_color TEXT NOT NULL DEFAULT '#0066cc';

-- 기본값 시드 (각 테넌트의 기존 color 또는 안전한 디폴트)
UPDATE tenants SET schedule_color = '#0066cc' WHERE id = 'WYLIE';
UPDATE tenants SET schedule_color = '#1d1d1f' WHERE id = 'LUSH';
