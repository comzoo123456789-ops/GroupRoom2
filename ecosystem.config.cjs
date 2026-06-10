// V12 §0: 샌드박스 리소스 보호 — 로그 폭주 + 메모리 누수 방지 설정 강화
module.exports = {
  apps: [
    {
      name: 'webapp',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        // V12: Node 메모리 상한 — 250MB 초과 시 가비지 컬렉션 강제 (샌드박스 1GB 제약 대응)
        NODE_OPTIONS: '--max-old-space-size=250'
      },
      watch: false,                  // 파일 감시 비활성 (CPU 절감)
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',    // V12: 400MB 초과 시 자동 재시작 (OOM 방지)
      kill_timeout: 5000,
      // V12: 로그 폭주 방지 — 로그 회전 활성화
      out_file: '/home/user/webapp/.pm2-logs/webapp-out.log',
      error_file: '/home/user/webapp/.pm2-logs/webapp-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // V12: 무한 재시작 방지
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
    }
  ]
};
