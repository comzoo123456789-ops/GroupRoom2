export const ShellPage = ({ page }: { page: string }) => {
  return (
    <div id="app-root" data-page={page}>
      <div id="app-loading" class="app-loading">
        <div class="loading-spinner"></div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/locale/ko.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
      {/* V6-3: 멤버 일괄 등록 엑셀(.xlsx/.csv) 파싱 */}
      <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
      <script src="/static/app.js"></script>
    </div>
  );
};
