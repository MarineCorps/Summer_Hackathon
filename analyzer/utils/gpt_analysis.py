import openai

def analyze_with_gpt(api_key, results):
    openai.api_key = api_key

    if not results or len(results) == 0:
        return "📭 분석 결과가 부족하여 GPT 요약이 불가능합니다."

    # 🔍 상위 5~10개 정도만 추림
    top_results = sorted(results, key=lambda r: abs(r["score"]), reverse=True)[:10]

    summary_lines = []
    for r in top_results:
        col1 = r.get("col1")
        col2 = r.get("col2")
        score = r.get("score")
        method = r.get("method")
        summary_lines.append(f"- {col1} 와 {col2} 는 {method} 기준 상관계수 {score}")

    summary_text = "\n".join(summary_lines)

    prompt = f"""
당신은 데이터 분석 전문가입니다.
다음은 여러 데이터 파일 간의 열쌍 상관관계 분석 결과입니다.

{summary_text}

이 결과를 바탕으로 사용자에게 데이터 간 상관관계를 쉽게 설명해주세요.
주요 패턴, 유의미한 상관성, 놀라운 점 등을 요약해주고, 기술 용어는 쉬운 말로 풀어주세요.
"""

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                { "role": "system", "content": "당신은 친절한 데이터 분석 요약 전문가입니다." },
                { "role": "user", "content": prompt }
            ],
            temperature=0.7
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        return f"❌ GPT 요약 실패: {str(e)}"
