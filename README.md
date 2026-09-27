# Research Thread Agent

논문·모델·코드 저장소를 한 화면에서 탐색하고, 연구 주제의 흐름과 개인 관심 분야를 정리하는 로컬 연구 탐색 도구입니다. FastAPI, Next.js, SQLite로 구성한 웹 인터페이스와 MCP 서버를 제공합니다.

## 주요 기능

| 기능 | 구현 |
|---|---|
| 빠른 검색 | Semantic Scholar 논문, Hugging Face 모델, GitHub 저장소 검색과 기간 필터 |
| 학습 경로 | 주제별 논문을 시기별로 모으고 요청 시 Claude로 변화 요약 |
| 인용 그래프·연구자 네트워크 | 인용 관계와 공동저자 메타데이터 시각화 |
| Trending·Reels | Hugging Face Daily Papers의 추천 논문 피드 |
| My Feed | 관심 키워드·분야 기반 알림과 로컬 검색 이력 |
| Venues | 학회·연도별 논문 탐색 |
| MCP | 검색·학습 경로·트렌드·학회·인용 그래프·개인 피드 도구 |

인용·공동저자 관계는 메타데이터 기반이며 직접적인 연구 계보나 지도 관계를 증명하지 않습니다. 웹 인터페이스는 구현되어 있고 Electron 설치형 패키징은 향후 과제입니다.

## 개발 배경

오픈소스 × AI 해커톤에서 4인 팀으로 개발했으며, 2026년 6월 4일 5위(Bronze Prize)를 수상했습니다. 공동 maintainer로서 빠른 검색, 학습 경로, 피드와 MCP 서버를 구현하고 팀원 PR 검토·병합과 제품 통합을 담당했습니다.

[koi2026의 팀 저장소](https://github.com/koi2026/research-thread-agent)는 이 저장소를 fork해 함께 개발했습니다.

## 설치와 실행

Python 3.10 이상, Node.js 18.18 이상과 npm이 필요합니다. 외부 데이터 검색에는 인터넷 연결이 필요합니다.

```bash
git clone https://github.com/hyeongus2/research-thread-agent.git
cd research-thread-agent
```

Windows에서는 `setup.bat` 후 `run.bat`, macOS/Linux에서는 `bash setup.sh` 후 `bash run.sh`를 실행합니다. 설치 스크립트는 Python 가상환경·npm 의존성을 준비하고 `.env.example`을 `.env`로 복사합니다.

- 웹 화면: <http://localhost:3000>
- API 문서: <http://localhost:8000/docs>
- 데이터: 저장소의 `data/research_thread.db` (자동 생성, Git 제외)

`.env` 또는 앱 설정에 필요한 키를 입력합니다. `ANTHROPIC_API_KEY`는 AI 요약, `GITHUB_TOKEN`은 인증된 GitHub 검색, `HF_API_TOKEN`·`SEMANTIC_SCHOLAR_API_KEY`는 해당 서비스 인증, `RESEND_API_KEY`·`USER_EMAIL`은 이메일 알림에 사용합니다. Claude 호출에는 API 사용료가 발생할 수 있으며 각 서비스의 한도와 모델 사용 가능 여부는 계정에 따라 다릅니다. API 키는 `.env`, 사용자 데이터는 로컬 SQLite에 저장합니다.

기본 실행 스크립트는 LAN 접속을 위해 백엔드를 모든 인터페이스에 바인딩합니다. 개인 PC에서만 사용할 경우 직접 `uvicorn api.main:app --host 127.0.0.1 --port 8000`으로 실행할 수 있습니다. 환경·모델 변경과 DB 초기화는 localhost 요청으로 제한됩니다. 인터넷 공개 배포용 인증 체계는 제공하지 않습니다.

## 구조와 MCP

`frontend/`는 화면, `api/`는 FastAPI 라우트, `services/`는 검색·요약·피드, `models/`와 `utils/database.py`는 SQLite 모델, `mcp_server/server.py`는 MCP 진입점입니다.

MCP 클라이언트에서 저장소 가상환경의 Python을 command, `mcp_server/server.py`의 절대 경로를 args로 지정합니다. 제공 도구는 `quick_search`, `learning_path`, `trending_papers`, `venue_papers`, `research_lineage`, `my_feed`입니다. `my_feed`는 웹앱 온보딩·관심 분야 설정 후 저장된 개인 피드를 읽습니다.

## 테스트

```bash
python -m unittest discover -s tests -v
cd frontend
npm run build
```

단위 테스트는 모델 설정의 localhost 제한, 잘못된 설정 처리, 실행 위치와 무관한 DB 경로를 검사합니다. 외부 검색·요약 기능의 통합 테스트에는 유효한 API 키가 필요합니다.

## 자료

- [전체 시연 영상 — 2026-05-22, 약 5분 2초](https://drive.google.com/file/d/1TFFgb1VDcJbT204dVoVkLG_PdA8YUoxc/view): 2026년 5월 개발 버전의 검색·탐색 흐름
- [팀 발표 — 2026-06-04, PPTX](https://github.com/hyeongus2/hyeongus2/blob/main/docs/talks/RTA-Team-Presentation-2026-06-04.pptx)
- [5위(Bronze Prize) 상장](https://github.com/hyeongus2/hyeongus2/blob/main/docs/certificates/KAIST-OpenSource-AI-award.pdf)
- [오픈소스 기여 수료증](https://github.com/hyeongus2/hyeongus2/blob/main/docs/certificates/KAIST-OpenSource-AI-completion.pdf)

## 라이선스

소스는 [MIT License](LICENSE)를 따릅니다. 외부 API 데이터와 팀 발표의 참고 이미지·문헌은 각각의 출처와 이용 조건을 따릅니다.
