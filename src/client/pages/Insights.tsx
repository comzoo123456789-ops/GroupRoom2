import { IconChart } from "../components/icons";
import { ComingSoon } from "./Timeline";

export default function Insights() {
  return (
    <ComingSoon
      icon={<IconChart size={28} />}
      title="이용 분석"
      desc="가동률·피크시간·실제 노쇼율·룸별 이용 패턴을 시각화합니다. 경쟁사 대비 압도적인 대시보드가 목표입니다."
      items={["룸별 가동률", "요일×시간 히트맵", "실제 노쇼율", "부서별 이용", "리포트 내보내기"]}
    />
  );
}
