from flask import Flask, request, jsonify, render_template
import pandas as pd
import os
import traceback
import json
from sklearn.preprocessing import MinMaxScaler
import numpy as np
from utils.analysis_runner import analyze_csv_pair, analyze_internal_columns
from utils.gpt_analysis import analyze_with_gpt
from utils.batch_analyzer import analyze_all_columns
from utils.timeseries_detect import analyze_timeseries  # ✅ 시계열 분석 모듈 추가

app = Flask(__name__, template_folder='templates')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 최대 업로드 크기 제한 (10MB)

UPLOAD_FOLDER = 'analyzer/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ✅ 업로드된 파일을 Pandas DataFrame으로 읽기 (CSV / XLSX 지원)
def read_uploaded_file(path):
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == ".csv":
            return pd.read_csv(path, encoding='utf-8')

        elif ext == ".xlsx":
            header_row = auto_detect_excel_header(path)
            print(f"📌 [엑셀] 헤더 자동 감지 결과: {header_row}행")

            # 1차 스캔: 날짜 컬럼 추정
            preview = pd.read_excel(path, engine="openpyxl", header=header_row, nrows=1)
            date_cols = [col for col in preview.columns if any(kw in str(col).lower() for kw in ["date", "time", "날짜", "일시", "측정일"])]

            # 실제 읽기 (날짜 컬럼 지정)
            return pd.read_excel(path, engine="openpyxl", header=header_row, parse_dates=date_cols)

        else:
            raise ValueError(f"지원하지 않는 파일 형식입니다: {ext}")

    except Exception as e:
        print(f"❌ 파일 읽기 실패: {path} → {e}")
        return pd.DataFrame()


# ✅ 자동 헤더 탐지 함수 (엑셀용)
def auto_detect_excel_header(path, max_rows=15):
    """
    엑셀 파일에서 '날짜', '시간', '측정일시' 등의 키워드가 포함된 행을 헤더로 자동 추정
    """
    try:
        preview = pd.read_excel(path, engine="openpyxl", header=None, nrows=max_rows)

        for i in range(max_rows):
            row = preview.iloc[i]
            text_row = row.astype(str).str.lower().fillna("")
            if text_row.str.contains("date|날짜|시간|일시|측정일").any():
                return i

    except Exception as e:
        print(f"⚠️ 헤더 자동 탐지 실패: {e}")

    return 0  # 실패하면 첫 번째 행을 기본 헤더로 사용

# ✅ 메인 페이지 라우팅
@app.route('/')
def home():
    return render_template("index.html")


# ✅ 1. 단일 비교 분석 (file1 vs file2)
@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        file1 = request.files.get('file1')
        file2 = request.files.get('file2')
        if not file1 or not file2:
            return jsonify({"error": "file1과 file2 파일이 모두 필요합니다."}), 400

        path1 = os.path.join(UPLOAD_FOLDER, file1.filename)
        path2 = os.path.join(UPLOAD_FOLDER, file2.filename)
        file1.save(path1)
        file2.save(path2)

        df1 = read_uploaded_file(path1)
        df2 = read_uploaded_file(path2)

        results = analyze_csv_pair(df1, df2) + analyze_internal_columns(df1) + analyze_internal_columns(df2)
        results.sort(key=lambda x: abs(x["score"]), reverse=True)

        response = {
            "results": results[:50],
            "matches": len(results)
        }

        print("✅ [analyze] 상관관계 결과 수:", len(results))
        enrich_response_with_visual_data(df1, response)

        if request.form.get("use_gpt", "false").lower() == "true":
            gpt_key = request.form.get("gpt_api_key", "")
            if gpt_key:
                df1_summary = df1.head(5).to_string()
                df2_summary = df2.head(5).to_string()
                response["gpt_summary"] = analyze_with_gpt(gpt_key, df1_summary, df2_summary)

        return jsonify(response)

    except Exception as e:
        print("❌ [analyze] 예외 발생:")
        traceback.print_exc()
        return jsonify({"error": "서버 내부 오류 발생", "detail": str(e)}), 500


# ✅ 2. 전체 분석 실행 (파일 여러 개 → 상관관계 or 시계열 분석)
@app.route('/analyze-all', methods=['POST'])
def analyze_all():
    try:
        files = request.files.getlist("files")
        paths = []

        for f in files:
            path = os.path.join(UPLOAD_FOLDER, f.filename)
            f.save(path)
            paths.append(path)

        if not paths:
            return jsonify({"error": "업로드된 파일이 없습니다."}), 400

        # ✅ 분석 유형 분기 처리
        analysis_type = request.form.get("analysis_type", "correlation")

        # ✅ [시계열 분석] 다중 파일 대응
        if analysis_type == "timeseries":
            results = {}

            for path in paths:
                filename = os.path.basename(path)
                df = read_uploaded_file(path)
                ts_result = analyze_timeseries(df)

                if not ts_result or "error" in ts_result:
                    results[filename] = {"error": ts_result.get("error", "분석 실패")}
                    continue

                results[filename] = ts_result

            return jsonify(results)

        # ✅ [상관관계 분석] 기존 방식 유지
        results = []
        result_path = os.path.join(UPLOAD_FOLDER, 'result.jsonl')
        with open(result_path, 'w', encoding='utf-8') as f_out:
            for r in analyze_all_columns(paths, threshold=0.3):
                f_out.write(json.dumps(r, ensure_ascii=False) + '\n')
                results.append(r)

        results.sort(key=lambda x: abs(x.get("score", 0)), reverse=True)
        df_first = read_uploaded_file(paths[0])

        response = {
            "results": results[:50],
            "matches": len(results),
            "result_file": result_path
        }

        enrich_response_with_visual_data(df_first, response)
        print("✅ [analyze-all] 시각화용 필드 포함 여부:",
              [k for k in response.keys() if k.endswith('_data') or k == 'results'])

        return jsonify(response)

    except Exception as e:
        print("❌ [analyze-all] 예외 발생:")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ✅ 3. 시각화용 필드 자동 생성 (line, box, bubble, radar, pie 등)
def enrich_response_with_visual_data(df, result: dict):
    try:
        if df.empty:
            print("⚠️ [enrich] 비어 있는 DataFrame, 시각화 생략")
            return

        print("🔍 [enrich] 시각화 컬럼:", df.columns.tolist())
        num_cols = df.select_dtypes(include='number').columns[:3]

        # ✅ 선형 차트용 (시계열)
        if 'Date' in df.columns and len(num_cols) > 0:
            x_vals = df['Date'].astype(str).tolist()
            y_vals = df[num_cols[0]].dropna().tolist()
            if len(x_vals) == len(y_vals):
                result["line_data"] = {
                    "x": x_vals,
                    "y": y_vals,
                    "xLabel": "Date",
                    "yLabel": num_cols[0]
                }

        # ✅ 박스플롯용
        if len(num_cols) >= 1:
            result["box_data"] = {
                "labels": list(num_cols),
                "dataList": [df[col].dropna().tolist() for col in num_cols]
            }

        # ✅ 버블 / 레이더
        if len(num_cols) >= 3:
            raw_data = df[num_cols].dropna().to_numpy()
            scaler = MinMaxScaler()
            scaled = scaler.fit_transform(raw_data)
            result["bubble_data"] = {
                "x": scaled[:, 0].tolist(),
                "y": scaled[:, 1].tolist(),
                "size": (scaled[:, 2] * 100).tolist(),
                "xLabel": num_cols[0],
                "yLabel": num_cols[1]
            }

            radar_sample = scaled[:3]
            indicators = [{"name": col, "max": 1} for col in num_cols]
            result["radar_data"] = {
                "indicators": indicators,
                "valuesList": radar_sample.tolist(),
                "names": [f"Sample {i+1}" for i in range(len(radar_sample))]
            }

        # ✅ 도넛차트용 (범주형)
        cat_cols = df.select_dtypes(include='object').columns
        if len(cat_cols) > 0:
            top_cat = cat_cols[0]
            freq = df[top_cat].value_counts()
            result["pie_data"] = {
                "labels": freq.index.tolist(),
                "values": freq.values.tolist()
            }

    except Exception as e:
        print("❌ [enrich] 시각화 데이터 생성 실패:", e)


# ✅ 4. 산점도 분석용 API (col1 vs col2)
@app.route('/scatter-data', methods=['GET'])
def scatter_data():
    try:
        col1 = request.args.get("col1")
        col2 = request.args.get("col2")
        if not col1 or not col2:
            return jsonify({"error": "col1, col2 파라미터가 필요합니다."}), 400

        files = sorted(
            [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith(('.csv', '.xlsx'))],
            key=lambda f: os.path.getmtime(os.path.join(UPLOAD_FOLDER, f)),
            reverse=True
        )

        if len(files) < 2:
            return jsonify({"error": "CSV 또는 XLSX 파일이 부족합니다."}), 400

        df1 = read_uploaded_file(os.path.join(UPLOAD_FOLDER, files[0]))
        df2 = read_uploaded_file(os.path.join(UPLOAD_FOLDER, files[1]))

        series1 = df1[col1] if col1 in df1 else df2.get(col1)
        series2 = df2[col2] if col2 in df2 else df1.get(col2)

        if series1 is None or series2 is None:
            return jsonify({"x": [], "y": []})

        if not pd.api.types.is_numeric_dtype(series1) or not pd.api.types.is_numeric_dtype(series2):
            return jsonify({"x": [], "y": []})

        series1 = series1.dropna().tolist()
        series2 = series2.dropna().tolist()
        length = min(len(series1), len(series2))

        return jsonify({
            "x": series1[:length],
            "y": series2[:length]
        })

    except Exception as e:
        print("❌ [scatter-data] 예외 발생:")
        traceback.print_exc()
        return jsonify({"error": "서버 오류", "detail": str(e)}), 500


# ✅ 5. 저장된 분석 결과 불러오기 (result.jsonl → 시각화용)
@app.route('/get-results', methods=['GET'])
def get_results():
    try:
        result_path = os.path.join(UPLOAD_FOLDER, 'result.jsonl')
        if not os.path.exists(result_path):
            return jsonify({"error": "결과 파일이 존재하지 않습니다."}), 404

        with open(result_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        results = [json.loads(line.strip()) for line in lines if line.strip()]
        results.sort(key=lambda x: abs(x.get("score", 0)), reverse=True)

        return jsonify({
            "results": results[:50],
            "matches": len(results)
        })

    except Exception as e:
        print("❌ [get-results] 예외 발생:")
        traceback.print_exc()
        return jsonify({"error": "서버 오류", "detail": str(e)}), 500


# ✅ 서버 실행
if __name__ == '__main__':
    app.run(port=5000, debug=True, use_reloader=False)
