# ✅ 통계 관련 수식 모듈
import pandas as pd
import numpy as np
from scipy.stats import chi2_contingency, f_oneway

# 📌 범주형 vs 범주형 분석: Cramér's V (카이제곱 기반)
def cramers_v(x, y):
    confusion = pd.crosstab(x, y)
    chi2, _, _, _ = chi2_contingency(confusion)
    n = confusion.sum().sum()
    r, k = confusion.shape
    return np.sqrt(chi2 / (n * (min(k, r) - 1)))

# 📌 수치형 vs 범주형 분석: Eta Squared (ANOVA 기반)
def eta_squared(numeric, categorical):
    try:
        # 카테고리별로 그룹 나누기
        groups = [numeric[categorical == cat] for cat in categorical.unique()]
        if len(groups) <= 1:
            return 0.0  # 그룹이 1개면 분석 무의미
        anova = f_oneway(*groups)
        return anova.statistic / (anova.statistic + (len(numeric) - len(groups)))
    except Exception:
        return 0.0  # 에러 시 0.0 반환
