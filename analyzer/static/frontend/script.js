import {
  drawBarChart,
  drawScatterChart,
  drawHeatmapChart,
  drawLineChart,
  drawBoxPlot,
  drawBubbleChart,
  drawRadarChart,
  drawPieChart
} from './charts.js';

// ✅ 테마 관련
let selectedPalette = 'auto';
let lastAnalysisResult = null; // ✅ 마지막 분석 결과 저장용

const paletteSelect = document.getElementById('paletteSelect');
const form = document.getElementById('uploadForm');

if (paletteSelect) {
  paletteSelect.addEventListener('change', () => {
    selectedPalette = paletteSelect.value;

    // ✅ 마지막 분석 결과가 있다면 테마만 재렌더링
    if (lastAnalysisResult) {
      const resultBox = document.getElementById("resultBox");
      const gptBox = document.getElementById("gptSummary");
      const cards = document.getElementById("summaryCards");
      const scatterSelect = document.getElementById("scatterSelect");

      cards.innerHTML = '';
      scatterSelect.innerHTML = '';
      renderAllCharts(lastAnalysisResult, resultBox, gptBox, cards, scatterSelect);
    }
  });
}

function getRecommendedTheme(type) {
  switch (type) {
    case 'bar':
    case 'line':
      return 'sequential';
    case 'scatter':
    case 'bubble':
      return 'diverging';
    case 'box':
      return 'categorical';
    default:
      return 'accessibility';
  }
}

function resolveTheme(type) {
  return selectedPalette === 'auto'
    ? getRecommendedTheme(type)
    : selectedPalette;
}

// ✅ 단일 비교 분석 요청
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData();
  formData.append('file1', form.file1.files[0]);
  formData.append('file2', form.file2.files[0]);
  formData.append('use_gpt', form.use_gpt.checked);
  formData.append('gpt_api_key', form.gpt_api_key.value);

  const resultBox = document.getElementById('resultBox');
  const gptBox = document.getElementById('gptSummary');
  const cards = document.getElementById('summaryCards');
  const scatterSelect = document.getElementById('scatterSelect');

  resultBox.style.display = 'none';
  gptBox.value = '';
  cards.innerHTML = '';
  scatterSelect.innerHTML = '';

  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      body: formData
    });

    const json = await res.json();
    console.log("✅ 분석 결과:", json);
    renderAllCharts(json, resultBox, gptBox, cards, scatterSelect);
  } catch (err) {
    resultBox.style.display = 'block';
    resultBox.textContent = '❌ 에러 발생:\n' + err.message;
  }
});

// ✅ 차트 렌더링 메인
async function renderAllCharts(json, resultBox, gptBox, cards, scatterSelect) {
  lastAnalysisResult = json;

  gptBox.value = json.gpt_summary || '없음';

  const top3 = json.results?.slice(0, 3) || [];
  top3.forEach(r => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `🔗 <strong>${r.col1} ↔ ${r.col2}</strong><br/>
      📈 상관계수: <strong>${r.score}</strong><br/>
      분석 방식: ${r.method}`;
    cards.appendChild(div);
  });

  const labels = json.results?.map(r => `${r.col1} ↔ ${r.col2}`) || [];
  const scores = json.results?.map(r => r.score) || [];

  if (labels.length && scores.length) {
    drawBarChart("chartBar", labels, scores, resolveTheme('bar'));
  }

  if (json.results?.length > 0) {
    drawHeatmapChart("chartHeatmap", json.results);

    // ✅ 산점도 가능한 쌍만 필터링
    scatterSelect.innerHTML = '';
    const validScatterPairs = [];

    await Promise.all(
      json.results.map(async (r, i) => {
        try {
          const res = await fetch(`/scatter-data?col1=${encodeURIComponent(r.col1)}&col2=${encodeURIComponent(r.col2)}`);
          const data = await res.json();
          if (Array.isArray(data.x) && Array.isArray(data.y) && data.x.length > 0 && data.x.length === data.y.length) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${r.col1} ↔ ${r.col2}`;
            scatterSelect.appendChild(opt);
            validScatterPairs.push(i);
          }
        } catch (e) {
          console.warn(`❌ 산점도 불가: ${r.col1} vs ${r.col2}`);
        }
      })
    );

    if (validScatterPairs.length > 0) {
      scatterSelect.addEventListener('change', () => updateScatter(json, scatterSelect.value));
      updateScatter(json, validScatterPairs[0]);
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.disabled = true;
      opt.textContent = '⚠️ 시각화 가능한 쌍 없음';
      scatterSelect.appendChild(opt);
    }
  }

  if (Array.isArray(json.line_data?.x) && Array.isArray(json.line_data?.y)) {
    const { x, y, xLabel, yLabel } = json.line_data;
    drawLineChart("chartLine", x, y, xLabel, yLabel, resolveTheme('line'));
  }

  if (Array.isArray(json.box_data?.dataList) && json.box_data.labels?.length > 0) {
    const { dataList, labels } = json.box_data;
    drawBoxPlot("chartBox", dataList, labels, resolveTheme('box'));
  }

  if (Array.isArray(json.bubble_data?.x) && Array.isArray(json.bubble_data?.y) && Array.isArray(json.bubble_data?.size)) {
    const { x, y, size, xLabel, yLabel } = json.bubble_data;
    drawBubbleChart("chartBubble", x, y, size, xLabel, yLabel, resolveTheme('bubble'));
  }

  if (Array.isArray(json.radar_data?.indicators) && Array.isArray(json.radar_data?.valuesList) && Array.isArray(json.radar_data?.names)) {
    const { indicators, valuesList, names } = json.radar_data;
    drawRadarChart("chartRadar", indicators, valuesList, names, resolveTheme('radar'));
  }

  if (Array.isArray(json.pie_data?.labels) && Array.isArray(json.pie_data?.values)) {
    const { labels, values } = json.pie_data;
    drawPieChart("chartPie", labels, values, resolveTheme('pie'));
  }

  setTimeout(() => {
    [
      'chartBar', 'chartScatter', 'chartHeatmap', 'chartLine',
      'chartBox', 'chartBubble', 'chartRadar', 'chartPie'
    ].forEach(id => {
      const chart = echarts.getInstanceByDom(document.getElementById(id));
      if (chart) chart.resize();
    });
  }, 300);

  resultBox.style.display = 'none';
  resultBox.textContent = JSON.stringify(json, null, 2);
}


// ✅ 산점도 요청
async function updateScatter(json, index) {
  const r = json.results?.[index];
  if (!r) return;

  try {
    const res = await fetch(`/scatter-data?col1=${encodeURIComponent(r.col1)}&col2=${encodeURIComponent(r.col2)}`);
    const data = await res.json();

    if (data.x?.length > 0 && data.x.length === data.y?.length) {
      drawScatterChart("chartScatter", data.x, data.y, r.col2, r.col1, resolveTheme('scatter'));
    } else {
      console.warn(`⚠️ 산점도 불가: ${r.col1} vs ${r.col2} → 수치형 아님 또는 길이 불일치`);
    }
  } catch (err) {
    console.error("❌ 산점도 불러오기 실패:", err);
  }
}

// ✅ 버블차트 정규화/복원
let originalBubbleData = null;

document.getElementById('normalizeBubbleBtn')?.addEventListener('click', () => {
  const chart = echarts.getInstanceByDom(document.getElementById('chartBubble'));
  if (!chart) return alert("❌ 버블차트를 먼저 분석해야 정규화할 수 있어요.");

  const option = chart.getOption();
  const data = option.series[0].data;
  if (!data || data.length === 0) return;

  if (!originalBubbleData) originalBubbleData = [...data];

  const sizes = data.map(d => d[2]);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  if (max === min) return alert("❗ 크기 값이 모두 동일해서 정규화할 수 없습니다.");

  const norm = sizes.map(v => ((v - min) / (max - min)) * 100);
  const newData = data.map((d, i) => [d[0], d[1], norm[i]]);

  chart.setOption({ series: [{ data: newData }] });
});

document.getElementById('resetBubbleBtn')?.addEventListener('click', () => {
  if (!originalBubbleData) return alert("❌ 정규화 이전 데이터가 없습니다.");
  const chart = echarts.getInstanceByDom(document.getElementById('chartBubble'));
  chart.setOption({ series: [{ data: originalBubbleData }] });
});

// ✅ 전체 분석 실행 → 바로 시각화
document.getElementById("analyzeAllBtn")?.addEventListener("click", async () => {
  const filesInput = document.getElementById("multiFiles");
  const resultBox = document.getElementById("resultBox");
  const gptBox = document.getElementById("gptSummary");
  const cards = document.getElementById("summaryCards");
  const scatterSelect = document.getElementById("scatterSelect");

  if (!filesInput.files.length) {
    resultBox.style.display = 'block';
    resultBox.textContent = "❗ 최소 하나 이상의 CSV 파일을 선택하세요.";
    return;
  }

  const formData = new FormData();
  Array.from(filesInput.files).forEach(f => formData.append("files", f));
  resultBox.textContent = "📡 분석 중...";
  resultBox.style.display = 'none';
  cards.innerHTML = '';
  gptBox.value = '';
  scatterSelect.innerHTML = '';

  try {
    const res = await fetch("/analyze-all", {
      method: "POST",
      body: formData
    });
    const json = await res.json();

    if (json.error) {
      resultBox.style.display = 'block';
      resultBox.textContent = "❌ 오류 발생: " + json.error;
      return;
    }

    console.log("📊 전체 분석 응답:", json);
    renderAllCharts(json, resultBox, gptBox, cards, scatterSelect);

  } catch (err) {
    resultBox.style.display = 'block';
    resultBox.textContent = "❌ 예외 발생: " + err.message;
  }
});
