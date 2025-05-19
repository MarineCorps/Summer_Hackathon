import pandas as pd
import traceback
import multiprocessing
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
from .correlation_detect import detect_correlation, is_valid_column
import os


# ✅ 개별 컬럼쌍 분석 함수 (score + method 반환)
def analyze_columns(col1, col2):
    try:
        score, method = detect_correlation(col1, col2)
        return score, method
    except Exception as e:
        print(f"❌ 분석 실패: {col1.name} vs {col2.name} → {e}")
        return None, None


# ✅ 파일을 안전하게 읽는 유틸 함수 (CSV + XLSX 자동 대응 + 단위행 제거)
def read_dataframe_safely(path):
    try:
        ext = os.path.splitext(path)[1].lower()
        if ext == ".csv":
            chunks = pd.read_csv(path, chunksize=10000)
            return pd.concat(chunks, ignore_index=True)

        elif ext == ".xlsx":
            # ✅ 1. 헤더 자동 탐지
            preview = pd.read_excel(path, engine="openpyxl", header=None, nrows=15)
            for i in range(15):
                row = preview.iloc[i]
                text_row = row.astype(str).str.lower().fillna("")
                if text_row.str.contains("date|날짜|시간|일시|측정일").any():
                    header_row = i
                    break
            else:
                header_row = 0

            # ✅ 2. 날짜 컬럼 미리 감지
            preview_named = pd.read_excel(path, engine="openpyxl", header=header_row, nrows=1)
            date_cols = [col for col in preview_named.columns if any(kw in str(col).lower() for kw in ["date", "time", "날짜", "일시", "측정일"])]

            # ✅ 3. 최종 읽기
            return pd.read_excel(path, engine="openpyxl", header=header_row, parse_dates=date_cols)

        else:
            raise ValueError(f"지원하지 않는 파일 형식: {ext}")

    except Exception as e:
        print(f"❌ 파일 읽기 실패: {path} → {e}")
        return pd.DataFrame()




# ✅ 스레드로 실행할 단일 작업 단위
def correlation_task(task_info):
    task_type = task_info['type']
    col1 = task_info['col1']
    col2 = task_info['col2']
    path1 = task_info['file1']
    path2 = task_info.get('file2')

    score, method = analyze_columns(col1, col2)
    if score is not None and abs(score) >= task_info['threshold']:
        if task_type == 'internal':
            return {
                "type": "internal",
                "file": path1,
                "col1": col1.name,
                "col2": col2.name,
                "score": score,
                "method": method
            }
        elif task_type == 'cross':
            return {
                "type": "cross",
                "file1": path1,
                "file2": path2,
                "col1": col1.name,
                "col2": col2.name,
                "score": score,
                "method": method
            }
    return None  # None이면 결과 버림


# ✅ 메인 분석 진입점 (내부 + 교차 컬럼 → 병렬 실행 + 진행률 표시)
def analyze_all_columns(file_paths, threshold=0.3, max_workers=None):
    if max_workers is None:
        cpu_count = multiprocessing.cpu_count()
        max_workers = max(2, min(cpu_count, 8))  # 과도한 쓰레드 방지
        print(f"⚙️ 사용 가능 논리 프로세서: {cpu_count} → 설정된 작업자 수: {max_workers}")

    tasks = []

    # 1. 내부 컬럼 비교 (유효 컬럼만 필터링)
    for path in file_paths:
        df = read_dataframe_safely(path)
        if df.empty:
            continue

        valid_cols = [df[c] for c in df.columns if is_valid_column(df[c])]
        print(f"🔍 [내부 비교] {path} 유효 컬럼 수: {len(valid_cols)}")

        for i in range(len(valid_cols)):
            for j in range(i + 1, len(valid_cols)):
                col1 = valid_cols[i]
                col2 = valid_cols[j]

                tasks.append({
                    "type": "internal",
                    "file1": path,
                    "col1": col1,
                    "col2": col2,
                    "threshold": threshold
                })

    # 2. 서로 다른 파일 간의 컬럼 비교 (유효 컬럼만 필터링)
    for i in range(len(file_paths)):
        for j in range(i + 1, len(file_paths)):
            path1 = file_paths[i]
            path2 = file_paths[j]

            df1 = read_dataframe_safely(path1)
            df2 = read_dataframe_safely(path2)
            if df1.empty or df2.empty:
                continue

            valid_cols1 = [df1[c] for c in df1.columns if is_valid_column(df1[c])]
            valid_cols2 = [df2[c] for c in df2.columns if is_valid_column(df2[c])]
            print(f"🔁 [크로스 비교] {path1} × {path2} → 유효 {len(valid_cols1)} x {len(valid_cols2)}")

            for col1 in valid_cols1:
                for col2 in valid_cols2:
                    tasks.append({
                        "type": "cross",
                        "file1": path1,
                        "file2": path2,
                        "col1": col1,
                        "col2": col2,
                        "threshold": threshold
                    })

    print(f"🚀 총 비교 작업 수: {len(tasks)} → 병렬 처리 시작 (max_workers={max_workers})")

    # 3. 병렬 처리 + 진행률
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(correlation_task, task) for task in tasks]
        for future in tqdm(as_completed(futures), total=len(futures), desc="🔍 분석 진행 중", ncols=90):
            try:
                result = future.result()
                if result:
                    yield result
            except Exception as e:
                print(f"❌ 스레드 예외 발생: {e}")
                traceback.print_exc()
