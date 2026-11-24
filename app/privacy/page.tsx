import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { buttonClassName } from "@/components/Button";
import { Card } from "@/components/Card";
import { ADMIN_CONTACT_EMAIL } from "@/lib/site";

// 개인정보 처리 안내 (공개 전 보안 점검 H2). 실제로 수집·저장·전송하는 항목을 그대로 적은 안내문이다.
// 코드가 바뀌어 수집 항목이 달라지면 이 문서도 함께 고친다. (PRD "개인정보 수집·보관" 항목과 같은 내용)

export const metadata = { title: "개인정보 처리 안내 · 오늘컨디션" };

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. 받는 정보와 쓰는 목적",
    body: (
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
        <li>
          <strong>체크인 값</strong>(수면 시간, 수면의 질, 피로도, 근육통 6부위, 기분, 어제 운동량)과 운동 수준: 오늘의 컨디션 점수·운동
          강도·제안을 만드는 데 씁니다. 건강과 관련된 정보입니다.
        </li>
        <li>
          <strong>이메일·비밀번호</strong>(가입한 경우): 로그인에 씁니다. 비밀번호는 원문이 아니라 복원할 수 없는 해시로만 저장합니다.
        </li>
        <li>
          <strong>계정에 저장하는 기록</strong>(가입한 경우): 체크인 값, 점수·강도, 제안, 제안 평가(👍/👎), 주 1회 체감 응답, 만 14세 확인과
          건강 정보 동의 시각.
        </li>
        <li>
          <strong>이용 기록</strong>(가입한 경우): 체크인에 걸린 시간, 제안이 3초 이상 보였는지 여부. 서비스 개선 지표를 재는 데만 씁니다.
        </li>
        <li>
          <strong>그 밖에 자동으로 쓰는 값</strong>: 로그인 상태 쿠키(30일), 기기 구분용 익명 번호 쿠키(1년, AI 호출 횟수를 세는 용도), 로그인
          시도 횟수(이메일을 해시한 값으로만 기록).
        </li>
      </ul>
    ),
  },
  {
    title: "2. AI 서비스로 보내는 정보 (국외 전송)",
    body: (
      <>
        <p className="mt-2">
          운동 제안 문장을 만들기 위해, 체크인 값(숫자 선택값)과 운동 수준, 이미 정해진 운동 강도를 미국의 AI 업체{" "}
          <strong>Anthropic</strong>의 서비스로 보냅니다. <strong>로그인하지 않아도</strong> 제안을 받을 때 같은 방식으로 보냅니다.
        </p>
        <p className="mt-2">
          이메일, 계정 번호, 이름 같은 <strong>누구인지 알 수 있는 정보는 보내지 않습니다.</strong> 직접 입력하는 글자 칸이 없어서, 보내는 값은
          모두 정해진 선택지입니다. AI는 점수와 강도를 바꿀 수 없고, 제안 문장만 만듭니다.
        </p>
      </>
    ),
  },
  {
    title: "3. 저장하는 곳과 보관 기간",
    body: (
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
        <li>
          가입한 사용자의 기록은 클라우드 데이터베이스(Supabase, 한국 리전)에 저장하며, 계정을 삭제하면 계정과 기록을 함께 삭제합니다.
        </li>
        <li>로그인하지 않은 사용자의 체크인 값은 서버에 저장하지 않습니다. 그 기기의 브라우저에만 오늘 입력값을 임시로 보관합니다.</li>
        <li>로그인 시도 기록은 잠금이 풀린 뒤 1일, AI 호출 횟수(접속 주소는 해시한 값)는 7일이 지나면 지웁니다.</li>
      </ul>
    ),
  },
  {
    title: "4. 삭제와 문의",
    body: (
      <>
        <p className="mt-2">
          로그인한 뒤 <Link href="/account" className="font-semibold text-accent underline">계정 화면</Link>에서 직접 계정과 기록을 모두
          삭제할 수 있습니다. 삭제하면 되돌릴 수 없습니다. 비밀번호를 잊었거나 그 밖에 문의할 일이 있으면 가입한 이메일 주소로 관리자에게
          연락해 주세요.
          {ADMIN_CONTACT_EMAIL ? (
            <>
              {" "}
              문의 주소:{" "}
              <a href={`mailto:${ADMIN_CONTACT_EMAIL}`} className="font-semibold text-accent underline">
                {ADMIN_CONTACT_EMAIL}
              </a>
            </>
          ) : null}
        </p>
      </>
    ),
  },
  {
    title: "5. 참고",
    body: (
      <p className="mt-2">
        이 서비스는 운동 계획을 돕는 참고용이며 의료 서비스가 아닙니다. 만 14세 미만은 가입할 수 없습니다. 이 안내는 서비스가 바뀌면 함께
        고칩니다.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <AppShell
      headerAction={
        <Link href="/" className={buttonClassName("secondary")}>
          체크인으로
        </Link>
      }
    >
      <Card as="div">
        <h1 className="text-xl font-bold">개인정보 처리 안내</h1>
        <p className="mt-1 text-ink-sub">오늘컨디션이 어떤 정보를 받고, 어디에 쓰고, 얼마나 보관하는지 알려 드려요.</p>
      </Card>
      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <h2 className="text-lg font-bold">{section.title}</h2>
          {section.body}
        </Card>
      ))}
    </AppShell>
  );
}
