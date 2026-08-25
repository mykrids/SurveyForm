# 커스텀 설문조사 SaaS — 바이브 코딩 지시어 (최종본 v2)

> v1(Claude) → Gemini 재검토 → 4가지 병목/보안 이슈 반영, 응답자 즉시 회신과
> 관리자 PDF 리포트 지연 발송을 분리한 최종 버전입니다.

---

## PART 1. AI 코딩 툴에 전달할 지시어

### [역할 지정]
너는 풀스택 웹 개발자야. Next.js 기반으로, krids 스타일의 랜딩 페이지를 갖추고
Google Forms / Google Apps Script(GAS) / Google Sheets와 연동되는 커스텀 설문조사 SaaS
플랫폼을 구축해 줘. 아래 아키텍처와 제약사항을 반드시 그대로 따라야 해.

---

### 1. 데이터 저장소 역할 분리

| 저장소 | 저장하는 데이터 | 접근 방식 |
|---|---|---|
| **Supabase** | 설문 메타데이터(기간, 중복방지 방식, 종료메시지 선택, 관리자 이메일), PDF 리포트 발송 상태(`report_sent`, `report_sent_at`), 중복 체크용 식별자 목록 | 백엔드(Next.js API Route)에서 `service_role key`로 접근. 클라이언트 노출 금지 |
| **Google Sheets** | 응답자가 제출한 실제 답변 내용 | **Next.js를 경유하는 GAS Web App**을 통해서만 기록/조회 (아래 2번) |

`surveys` 테이블에는 최소 아래 컬럼을 포함한다:
`id, title, start_at, end_at, report_delay_hours(기본값 1), duplicate_check_type,
end_message_preset, gas_webapp_url, admin_email, report_sent(boolean), report_sent_at`

---

### 2. Google 연동 아키텍처

1. **[설문 구조 읽기]**: Google Forms API로 질문 데이터를 JSON으로 가져와 커스텀 UI로
   재렌더링한다.
   - **MVP에서 지원하는 문항 유형은 아래 4가지로 제한한다**: 단답형(Short Answer),
     장문형(Paragraph), 단일선택(Multiple Choice/Radio), 복수선택(Checkboxes).
   - 이 외 유형(객관식 그리드, 선형 배율, 섹션 분기, 날짜/시간 선택, 파일 업로드 등)이
     감지되면 **코드가 깨지지 않도록 파싱 단계에서 명시적으로 예외 처리**하고, 관리자 설정
     화면에 "이 설문에는 지원되지 않는 문항 유형이 포함되어 있습니다: [문항명]" 경고를
     표시한다. 조용히 무시하거나 렌더링 오류를 내지 않도록 한다.

2. **[응답 데이터 저장 — 보안 강화 구조]**:
   - **클라이언트(브라우저)는 GAS Web App URL에 절대 직접 요청하지 않는다.** 반드시
     `클라이언트 → Next.js API Route → GAS Web App` 순서로만 통신한다.
   - Next.js와 GAS 사이에는 **공유 시크릿(Shared Secret)을 Bearer 토큰 형태의 헤더**로
     주고받아, 시크릿이 없거나 틀린 요청은 GAS 스크립트 내부에서 즉시 거부하도록 구현한다.
     (환경변수 `GAS_SHARED_SECRET`, GAS 쪽은 Script Properties에 동일 값 저장)
   - GAS Web App은 하나의 배포 URL에서 `action` 파라미터로 두 가지 기능을 라우팅한다:
     - `action=write`: 응답 데이터를 시트에 한 행으로 추가
     - `action=read`: (배치 리포트 생성 시에만 사용) 시트 전체 데이터를 JSON으로 반환
   - 이렇게 하면 별도로 Sheets API 서비스 계정 인증/시트 공유 설정을 추가할 필요가 없다.

3. **UI 브랜딩**: 응답자 화면에는 구글 로고/제출 버튼 등 구글 기본 UI 요소를 노출하지 않는
   커스텀 디자인을 적용한다. (실제 데이터 처리 주체 고지는 개인정보처리방침에서 별도 처리 —
   PART 2 참고)

---

### 3. 관리자 설문 설정 기능 (Admin Control Panel)

1. **설문 기간 설정**: 시작/종료 일시(DatePicker). 기간 외 접속 시 안내 페이지 출력.
2. **중복 응답 제한** (관리자가 On/Off 및 방식 선택):
   - 방식 A: 쿠키/LocalStorage 기반 — 완전 차단 아님을 툴팁으로 고지.
   - 방식 B: 이메일 기반 — 저장 전 **이메일 정규화(소문자 변환 + `+태그` 제거,
     예: `abc+1@gmail.com` → `abc@gmail.com`)** 를 기본 적용해 가장 흔한 우회를 막는다.
     단, 이 역시 완전한 검증은 아니므로 "완전한 부정 응답 차단은 아닙니다" 문구를 관리자
     UI에 표시한다. **OTP/이메일 인증 링크를 통한 강력한 검증은 MVP 범위 밖으로 분리**하고,
     추후 버전에서 옵션으로 추가할 수 있도록 설정 스키마에 확장 여지만 남겨둔다
     (`duplicate_check_type` 값에 `email_verified`를 나중에 추가 가능하도록 enum 설계).
3. **종료 메시지 템플릿 선택 (10종 프리셋)**: 기존과 동일 — (1)~(10) 상수 정의,
   관리자가 드롭다운으로 선택.

---

### 4. 응답 처리 흐름 — 두 갈래로 명확히 분리 (핵심 변경사항)

**A. 응답자 제출 시 (즉시 처리)**

1. 응답자가 커스텀 UI에서 제출 → Next.js API Route(`/api/submit`)로 payload 전송.
2. Next.js가 Supabase에서 해당 설문의 기간/중복방지 조건을 조회·검증.
3. 통과 시 Next.js가 `GAS_SHARED_SECRET` 헤더와 함께 GAS `action=write`를 호출해 시트에
   응답 저장.
4. **GAS 저장 성공 응답을 받는 즉시, Next.js는 이미 갖고 있는 payload와 Supabase에 저장된
   `end_message_preset` 값을 그대로 사용해 응답자 이메일로 확인 메일을 Resend로 즉시 발송한다.**
   (시트를 다시 읽지 않으므로 동기화 지연 문제가 발생하지 않는다.)
5. 화면에는 관리자가 선택한 종료 메시지를 담은 커스텀 완료 페이지를 표시.
6. Supabase의 중복 체크 로그 테이블에 응답 식별자 기록.

**B. 관리자용 PDF 리포트 (설문 종료 후 지연 배치 처리)**

1. **Vercel Cron(`vercel.json`의 `crons` 설정) 또는 별도 스케줄러**가 예: 매시간
   `/api/cron/generate-reports` 를 호출.
2. 이 API는 Supabase에서 `end_at + report_delay_hours <= 현재시각 AND report_sent = false`
   조건을 만족하는 설문을 조회.
3. 해당 설문마다 GAS `action=read`를 호출해 그 시점까지 누적된 시트 데이터를 통째로
   가져온다 (이미 충분한 지연 시간이 지났으므로 GAS 쓰기 지연으로 인한 데이터 누락 우려가 없다).
4. `@react-pdf/renderer`로 응답 통계 요약 PDF 생성.
5. Resend로 관리자 이메일에 PDF 첨부 발송.
6. 발송 성공 시 Supabase `report_sent = true`, `report_sent_at = now()` 업데이트 (중복
   발송 방지).

---

### 5. PDF 생성 라이브러리 및 배포 환경

- `@react-pdf/renderer` 또는 `pdf-lib`를 기본으로 사용한다. `puppeteer`는 사용하지 않는다
  (Vercel 서버리스 환경에서 헤드리스 크로미움 실행이 타임아웃·번들 크기 문제로 실패하기
  쉽기 때문). 배포 환경이 별도 Node 서버(Docker/Railway 등)로 확정된 경우에만 예외적으로
  `puppeteer-core` 조합을 고려한다.

---

### 6. 보안 체크리스트 (필수 준수)

- `service_role key`, Google 서비스 계정 Private Key, `RESEND_API_KEY`,
  `GAS_SHARED_SECRET` — 어떤 것도 `NEXT_PUBLIC_` 접두사를 붙이지 말 것.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 노출 전제 설계이므로 그대로 사용.
- `.env`, `.env.local`, 구글 서비스 계정 JSON 파일은 `.gitignore`에 반드시 포함.
- `/api/submit`, `/api/cron/generate-reports` 두 엔드포인트에는 기본적인 요청 속도 제한
  (rate limiting)을 적용해 스팸성 대량 요청을 방지한다. `/api/cron/*`는 별도의 Cron
  Secret 헤더로도 보호해 외부에서 직접 호출하지 못하게 한다.

---

### 7. 랜딩 페이지 구조

- 히어로 섹션, 주요 기능 소개, 설문 템플릿 카드 갤러리, 요금제 안내.
- 템플릿 선택 시 커스텀 설문 응답 페이지로 이동.
- 모든 텍스트/이미지는 모듈화된 데이터 구조(JSON/상수 파일)로 관리.

---

### 8. 개발 단계별 진행 요청

1. 랜딩 페이지 UI + 관리자 설정 패널(기간/중복방지/종료메시지 드롭다운) 구현
2. Google Forms API 연동 — 지원 문항 유형 파싱 + 미지원 유형 경고 처리
3. `/api/submit` 구현 — 조건 검증 → GAS write 호출 → 응답자 즉시 확인 메일 발송
4. GAS Web App 구현 — `action=write` / `action=read` 라우팅 + 시크릿 검증
5. `/api/cron/generate-reports` 구현 — 지연 조건 조회 → GAS read → PDF 생성 → 관리자
   메일 발송 → 상태 업데이트
6. Vercel Cron 설정 (`vercel.json`)

---

## PART 2. 코딩 시작 전 준비사항

### 1) Google Cloud Console 설정
1. Google Cloud Console 로그인 → 새 프로젝트 생성
2. **API 및 서비스 > 라이브러리**에서 **Google Forms API** 활성화 (Drive API는 폼 목록
   조회가 필요할 때만 추가, 필수는 아님)
3. **서비스 계정 생성** → 키(Keys) 탭 → 새 키 발급(JSON) → 안전한 곳에 보관
4. **⚠️ 필수**: 발급된 서비스 계정 이메일(`xxxx@xxxx.iam.gserviceaccount.com`)을 복사해두고,
   테스트할 각 Google Form을 이 이메일로 **"뷰어" 권한 공유**. 누락 시 Forms API 403 에러.

### 2) Google Apps Script(GAS) 준비
1. 응답 저장용 Google Sheet 생성 → 확장 프로그램 > Apps Script.
2. `doPost(e)` 함수에서 `action` 파라미터로 `write`/`read` 분기 처리하는 스크립트 작성.
3. 요청 헤더(또는 payload) 안의 시크릿 값을 **Script Properties에 저장해둔 값과 비교**하는
   검증 로직을 최상단에 추가 (불일치 시 즉시 401 응답).
4. **배포 > 새 배포 > 웹 앱**, 액세스 권한 "모든 사용자"로 배포 → 생성된 웹 앱 URL 메모.
5. Script Properties에 `SHARED_SECRET` 값을 등록 (Next.js `.env`의 `GAS_SHARED_SECRET`과
   동일한 값이어야 함).

### 3) Supabase 설정
1. Supabase 가입 → 새 프로젝트 생성 → `Project URL`, `anon key`, `service_role key` 확보.
2. 아래 두 테이블을 미리 염두에 둘 것:
   - `surveys` (PART 1 - 1번 컬럼 목록 참고, `report_delay_hours` 기본값 1~24 사이로 설정)
   - `survey_responses_log` (survey_id, respondent_identifier, submitted_at — 응답
     내용 자체는 저장하지 않고 중복 체크용으로만 사용)

### 4) 이메일 발송 (Resend) 준비
1. Resend 가입 → API Key 발급.
2. 발신 도메인 인증(DNS 설정) — 즉시 발송되는 응답자 확인 메일이 스팸함으로 가지 않도록
   미리 설정해두는 것을 권장.

### 5) 개발 환경 및 배포
1. Node.js LTS, Git 설치.
2. 배포 플랫폼을 Vercel로 정한다면, `vercel.json`에 Cron 설정을 추가할 준비:
   ```json
   {
     "crons": [
       { "path": "/api/cron/generate-reports", "schedule": "0 * * * *" }
     ]
   }
   ```
3. Cron 엔드포인트 보호용 시크릿(`CRON_SECRET`)도 별도로 준비해 `.env`에 등록.

### 6) 코딩 시작 전 최종 체크리스트
- [ ] Google Cloud 프로젝트 생성 + Forms API 활성화
- [ ] 서비스 계정 JSON 키 발급 및 보관
- [ ] 테스트용 Google Form 생성 + 서비스 계정 이메일로 뷰어 공유
- [ ] 응답 저장용 Google Sheet 생성 + GAS 스크립트(write/read 라우팅 + 시크릿 검증) 작성
- [ ] GAS 웹앱 배포 + URL 확보 + Script Properties에 `SHARED_SECRET` 등록
- [ ] Supabase 프로젝트 생성 + URL/anon key/service_role key 확보
- [ ] Resend 가입 + API Key 발급 (+ 발신 도메인 인증)
- [ ] Node.js, Git 설치 확인
- [ ] 배포 플랫폼 결정 (Vercel 권장) + Cron 설정 준비
- [ ] `.env.example` 정리:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  GOOGLE_SERVICE_ACCOUNT_JSON_PATH=
  RESEND_API_KEY=
  GAS_SHARED_SECRET=
  CRON_SECRET=
  ```

### 7) 참고 — 법적/정책 관련 유의사항
- 개인정보처리방침에 "설문 응답은 Google Sheets에, 운영 정보는 Supabase에 저장되며,
  이메일 발송은 Resend를 통해 이루어집니다"를 고지하는 것을 권장합니다. UI에서 구글
  브랜딩을 제거하는 것과 실제 데이터 처리 주체를 사용자에게 고지하는 것은 별개의 문제입니다.
- 이메일 기반 중복 방지는 완전한 부정 응답 방지 수단이 아님을 서비스 이용약관/관리자
  안내에도 명시하는 것을 권장합니다.
