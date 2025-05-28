# 데이터 분석기 (Hackathon Demo)

개인 해커톤 작업의 하나로, 모든 CSV/액셀 파일을 조회/시계열/상관관계 구조로 분석해 시각화하고, 결과를 계산과 포맷으로 저장/보기할 수 있는 전자 서비스입니다.

> ⚠️ 현재는 데모 버전으로, 상관관계분석 알고리즘, 특정 형식의 CSV/XLSX 파일에서 발생할 수 있는 오류가 있습니다. 오류 해결과 기능 추가 과정을 계획중입니다.

---

## 🔍  기능

* 다중 Excel/CSV 파일 업로드 가능
* 날짜 기반 시계열 차트 (Line, Bar, Area)
* 상관관계 분석 (Pearson, ANOVA, Cramér's V)
* Scatter, Bubble, Pie, Radar 시각화
* ECharts 기반 반응형 차트
* 결과 보관: `.jsonl` 저장 기능
* GPT 구조 보조적 웹에이지 보조 기능 (choice)

---

## 🗒️ 사용 예시

1. 분석 파일 Drag & Drop
2. 시계열/상관관계 분석 옵션 선택
3. 시각화 차트 자동 생성
4. 결과 보기/요약 표시

---

## 💡 기술 스택

| 구조       | 사용 기술                      |
| -------- | -------------------------- |
| Backend  | Python 3.9, Flask          |
| Frontend | HTML, CSS, JS, ECharts     |
| Analysis | Pandas, Scipy, Statsmodels |
| Storage  | JSONL 기능, 파이썬 파일 저장        |

---

## 📁 파일 구조

```
📦 analyzer
 ┣ 📂 utils                # 분석 로직 (correlation, timeseries, statistical)
 ┣ 📂 routes               # Flask routing 과 결과 처리
 ┣ 📂 static/frontend      # CSS/JS/이미지
 ┣ 📂 templates            # HTML 템플릿
 ┣ 📂 uploads              # 업로드 파일 저장
 ┣ 📜 app.py               # Flask 메인 연결점
 ┗ 📜 requirement.txt      # 패키지 목록
```

---

## 🚧 해결 계획

* 모든Excel 포맷 자동 검색 및 단일 포맷 개정
* 상관관계 분석 알고리즘 수정예정
* 시계열 + 상관관계 모두 다른 차트 목록 포함
* 결과 저장 DB 및 목록 보기 기능 복구 예정

---

## 📅 개발 및 보고 목적

교통, 도시건강, 인구 문제 등 지역 기본 데이터를 분석해, 시민의 필요에 반응하는 지자체를 만들고자 해커톤 프로젝트 목표로 선정했습니다.

---

## 📢 문의

비영리 목적의 해커톤 데모 프로젝트입니다. 기술적 개정은 환영합니다(아무나 가져가셔서 수정해서 사용하셔도 됩니다).
