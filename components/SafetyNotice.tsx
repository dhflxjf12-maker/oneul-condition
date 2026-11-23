import { Card } from "./Card";

// Design Ref: §5.2 — 참고용·전문가 상담 안내문은 결과 화면에서 항상 보여 준다. (PRD 건강 안전 안내)

/** 참고용 안내문 (의료 서비스가 아님) */
export function SafetyNotice() {
  return (
    <Card aria-labelledby="safety-heading">
      <h2 id="safety-heading" className="text-base font-bold">
        참고용 안내입니다
      </h2>
      <p className="mt-1 text-ink-sub">
        이 결과는 운동 계획을 돕는 참고용이며 의료 서비스가 아닙니다. 가슴 통증, 어지러움, 호흡 곤란 같은 증상이 있으면
        운동을 멈추고 전문가와 상담하세요.
      </p>
    </Card>
  );
}
