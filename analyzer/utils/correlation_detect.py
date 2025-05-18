import pandas as pd
import numpy as np
import warnings
from scipy.stats import chi2_contingency, f_oneway

# ✅ 범주형 vs 범주형 → Cramér's V
def cramers_v(x, y):
    try:
        confusion = pd.crosstab(x, y)
        chi2, _, _, _ = chi2_contingency(confusion)
        n = confusion.sum().sum()
        r, k = confusion.shape

        if min(k, r) <= 1 or n == 0:
            return None

        return np.sqrt(chi2 / (n * (min(k, r) - 1)))
    except Exception as e:
        print(f"❌ Cramér's V 실패: {e}")
        return None

# ✅ 수치형 vs 범주형 → Eta Squared (ANOVA 기반)
def eta_squared(numeric, categorical):
    try:
        groups = [numeric[categorical == cat].dropna() for cat in categorical.dropna().unique()]
        groups = [g for g in groups if len(g) >= 2]
        if len(groups) < 2:
            return None

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            anova = f_oneway(*groups)

        return anova.statistic / (anova.statistic + (len(numeric) - len(groups)))
    except Exception as e:
        print(f"❌ Eta Squared 실패: {e}")
        return None

# ✅ 범주형 판별 함수
def is_categorical(col):
    dtype = col.dtype
    return (
        isinstance(dtype, pd.CategoricalDtype) or
        pd.api.types.is_object_dtype(col) or
        pd.api.types.is_bool_dtype(col)
    )

# ✅ 단일 컬럼이 유효한지 검사
def is_valid_column(col, min_unique=2, max_null_ratio=0.9):
    if col is None or col.empty:
        return False
    null_ratio = col.isnull().mean()
    unique_count = col.nunique(dropna=True)
    return null_ratio < max_null_ratio and unique_count >= min_unique

# ✅ 컬럼쌍이 의미 있는 조합인지 검사
def is_valid_pair(col1, col2):
    return (
        is_valid_column(col1) and
        is_valid_column(col2) and
        not col1.equals(col2)
    )

# ✅ 상관 분석 라우팅 함수 (필터 포함)
def detect_correlation(col1, col2):
    try:
        if not is_valid_pair(col1, col2):
            return None, "Invalid Pair"

        if pd.api.types.is_numeric_dtype(col1) and pd.api.types.is_numeric_dtype(col2):
            return col1.corr(col2), "Pearson"

        if is_categorical(col1) and is_categorical(col2):
            return cramers_v(col1, col2), "Cramér's V"

        if pd.api.types.is_numeric_dtype(col1) and is_categorical(col2):
            return eta_squared(col1, col2), "Eta Squared"

        if pd.api.types.is_numeric_dtype(col2) and is_categorical(col1):
            return eta_squared(col2, col1), "Eta Squared"

        return None, "Unsupported"
    except Exception as e:
        print(f"❌ detect_correlation 예외: {e}")
        return None, "Error"
