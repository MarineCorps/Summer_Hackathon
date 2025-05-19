import pandas as pd
from datetime import timedelta
from collections import defaultdict

def try_parse_datetime_column(series: pd.Series):
    """다양한 날짜 포맷 시도하여 유효하면 반환, 실패 시 fallback으로 dateutil 사용"""
    formats = [
        "%Y-%m-%d %H", "%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d",
        "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M", "%Y.%m.%d %H",
        "%Y년 %m월 %d일", "%Y.%m.%d %p %I",
    ]

    # ✅ ':' → 공백, strip
    series = series.astype(str).str.replace(":", " ", regex=False).str.strip()

    for fmt in formats:
        try:
            parsed = pd.to_datetime(series, format=fmt, errors='coerce')
            print(f"⏱️ 시도 중: {fmt}, 성공률: {parsed.notnull().mean():.2f}")
            if parsed.notnull().mean() > 0.7:
                return parsed
        except Exception as e:
            print(f"❌ 포맷 실패: {fmt} → {e}")
            continue

    print("⚠️ 모든 포맷 실패 → dateutil fallback 적용")
    return pd.to_datetime(series.astype(str), errors='coerce')

def clean_column_names(df):
    df.columns = [col if not col.startswith("Unnamed") else f"열{idx}" for idx, col in enumerate(df.columns)]
    return df

from collections import defaultdict
import pandas as pd
from datetime import timedelta

def analyze_timeseries(df: pd.DataFrame, time_column: str = ""):
    """
    📈 시계열 분석 로직 (자동 날짜 탐지 + 사용자 입력 + 단위행 제거 + 수치형 강제 변환 포함)
    """
    df = clean_column_names(df)

    # ✅ 1. 날짜 컬럼 선택
    if time_column and time_column in df.columns:
        print(f"📝 사용자 입력 날짜 컬럼 사용: {time_column}")
        time_col = time_column
    else:
        date_keywords = ["date", "time", "날짜", "일시", "측정일", "측정시간"]
        datetime_cols = [col for col in df.columns if any(kw in str(col).lower() for kw in date_keywords)]

        if not datetime_cols:
            print("❌ 날짜 컬럼 자동 탐지 실패")
            return {"error": "날짜를 자동으로 인식할 수 없습니다. 날짜 컬럼명을 직접 입력해주세요."}

        time_col = datetime_cols[0]
        print(f"🔍 자동 감지된 날짜 컬럼: {time_col}")

    # ✅ 2. 디버깅 출력
    print("\n🧪 [DEBUG] 날짜 컬럼 상태 점검")
    print("📌 dtype:", df[time_col].dtype)
    print("📌 null 비율:", df[time_col].isnull().mean())
    print("📌 상위 5개 값:", df[time_col].head(5).tolist())
    print("📌 타입 분포:", df[time_col].apply(lambda x: type(x)).value_counts())

    # ✅ 3. 날짜 파싱
    try:
        if pd.api.types.is_numeric_dtype(df[time_col]):
            print("📌 날짜 컬럼이 숫자 형식 → 엑셀 일련번호로 처리")
            df[time_col] = pd.to_datetime("1899-12-30") + pd.to_timedelta(df[time_col], unit="D")
        else:
            df[time_col] = try_parse_datetime_column(df[time_col])

        df = df.dropna(subset=[time_col])

    except Exception as e:
        print(f"❌ 날짜 파싱 예외: {e}")
        return {"error": "날짜 컬럼 파싱 중 오류가 발생했습니다. 날짜 형식을 확인해주세요."}

    if df.empty:
        print("❌ 유효한 날짜 데이터 없음")
        return {"error": "날짜 형식 파싱에 실패했습니다. 다른 날짜 컬럼명을 입력하거나 형식을 확인해주세요."}

    # ✅ 4. 수치형 변환 시도
    for col in df.columns:
        if col != time_col and df[col].dtype == 'object':
            try:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            except:
                pass

    # ✅ 5. 수치형 컬럼 선택
    numeric_cols = df.select_dtypes(include='number').columns.tolist()
    valid_numeric_cols = [
        col for col in numeric_cols if df[col].notnull().sum() >= 10 and df[col].nunique() > 2
    ]

    if not valid_numeric_cols:
        print("❌ 유효한 수치형 컬럼 없음")
        return {"error": "시계열로 분석할 수치형 컬럼이 없습니다."}

    y_col = sorted(valid_numeric_cols, key=lambda col: df[col].isnull().mean())[0]

    # ✅ 6. 정렬 및 값 추출
    df = df[[time_col, y_col]].dropna().sort_values(by=time_col)
    df["date"] = df[time_col].dt.date
    df["hour"] = df[time_col].dt.hour

    # ✅ 결과 구조 초기화
    result = {
        "line_data": {
            "x": df[time_col].astype(str).tolist(),
            "y": df[y_col].tolist(),
            "xLabel": str(time_col),
            "yLabel": str(y_col)
        }
    }

    # ✅ 일별 평균
    g_daily = df.groupby("date")[y_col].mean().reset_index()
    result["line_daily"] = {
        "x": g_daily["date"].astype(str).tolist(),
        "y": g_daily[y_col].tolist(),
        "xLabel": "날짜",
        "yLabel": y_col
    }

    # ✅ 월별 평균
    df["month"] = df[time_col].dt.to_period("M").astype(str)
    g_month = df.groupby("month")[y_col].mean().reset_index()
    result["line_monthly"] = {
        "x": g_month["month"].tolist(),
        "y": g_month[y_col].tolist(),
        "xLabel": "월",
        "yLabel": y_col
    }

    # ✅ 날짜별 시간대별 값 (0~23시)
    from collections import defaultdict
    hourly_by_date = defaultdict(lambda: [None] * 24)

    g = df.groupby(["date", "hour"])[y_col].mean().reset_index()
    for _, row in g.iterrows():
        date_str = str(row["date"])
        hour = int(row["hour"])
        value = float(row[y_col])
        hourly_by_date[date_str][hour] = value

    result["line_hourly_by_date"] = dict(hourly_by_date)

    print(f"✅ 시계열 분석 성공: {len(df)}행, X={time_col}, Y={y_col}")
    return result

