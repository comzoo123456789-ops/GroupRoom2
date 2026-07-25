-- 회의 상세: 안건 / 화상회의 링크 / 자료·메모
ALTER TABLE reservations ADD COLUMN agenda TEXT;
ALTER TABLE reservations ADD COLUMN video_url TEXT;
ALTER TABLE reservations ADD COLUMN notes TEXT;
