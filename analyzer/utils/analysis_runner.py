import pandas as pd
from .correlation_detect import detect_correlation

# ✅ 파일 간 컬럼 쌍 비교
def analyze_csv_pair(df1, df2, threshold=0.6):
    results = []
    for col1 in df1.columns:
        for col2 in df2.columns:
            try:
                score, method = detect_correlation(df1[col1].dropna(), df2[col2].dropna())
                if score is not None and abs(score) > threshold:
                    results.append({
                        "col1": col1,
                        "col2": col2,
                        "score": round(score, 3),
                        "method": method
                    })
            except:
                continue
    return results

# ✅ 단일 파일 내부의 열 쌍 분석
def analyze_internal_columns(df, threshold=0.6):
    results = []
    cols = df.columns
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            col1, col2 = cols[i], cols[j]
            try:
                score, method = detect_correlation(df[col1].dropna(), df[col2].dropna())
                if score is not None and abs(score) > threshold:
                    results.append({
                        "col1": col1,
                        "col2": col2,
                        "score": round(score, 3),
                        "method": method
                    })
            except:
                continue
    return results
