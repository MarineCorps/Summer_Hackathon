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

import { setupLineChartFilter } from './line_chart_filter.js';

let selectedPalette = 'auto';
let lastAnalysisResult = null;
let originalBubbleData = null;

// ✅ 외부에서 테마 설정 가능하게 export
export function setThemePalette(palette) {
  selectedPalette = palette;
}

// ✅ 외부에서 마지막 분석 결과 접근
export function getLastResult() {
  return lastAnalysisResult;
}

// ✅ 차트별 추천 테마
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

// ✅ 메인 차트 렌더링
export async function renderAllCharts(json, resultBox, gptBox, cards, scatterSelect) {
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

    scatterSelect.replaceChildren(); // 안전 초기화
    scatterSelect.onchange = null;   // 이벤트 중복 제거
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
    setupLineChartFilter(json); // ✅ 필터 연동 (daily 디폴트)
  }

  if (Array.isArray(json.box_data?.dataList) && json.box_data.labels?.length > 0) {
    const { dataList, labels } = json.box_data;
    drawBoxPlot("chartBox", dataList, labels, resolveTheme('box'));
  }

  if (Array.isArray(json.bubble_data?.x) && json.bubble_data?.y && json.bubble_data?.size) {
    const { x, y, size, xLabel, yLabel } = json.bubble_data;
    drawBubbleChart("chartBubble", x, y, size, xLabel, yLabel, resolveTheme('bubble'));
    originalBubbleData = x.map((val, i) => [x[i], y[i], size[i]]);
  }

  if (Array.isArray(json.radar_data?.indicators) && json.radar_data?.valuesList && json.radar_data?.names) {
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
}

// ✅ 산점도 렌더링
export async function updateScatter(json, index) {
  const r = json.results?.[index];
  if (!r) return;

  try {
    const res = await fetch(`/scatter-data?col1=${encodeURIComponent(r.col1)}&col2=${encodeURIComponent(r.col2)}`);
    const data = await res.json();

    if (data.x?.length > 0 && data.x.length === data.y?.length) {
      drawScatterChart("chartScatter", data.x, data.y, r.col2, r.col1, resolveTheme('scatter'));
    } else {
      console.warn(`⚠️ 산점도 불가: ${r.col1} vs ${r.col2}`);
    }
  } catch (err) {
    console.error("❌ 산점도 불러오기 실패:", err);
  }
}

// ✅ 버블 차트 정규화 (script.js에서 호출 가능)
export function normalizeBubble() {
  const chart = echarts.getInstanceByDom(document.getElementById('chartBubble'));
  if (!chart || !originalBubbleData) return;

  const option = chart.getOption();
  const data = option.series[0].data;
  if (!data || data.length === 0) return;

  const sizes = data.map(d => d[2]);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  if (max === min) return;

  const norm = sizes.map(v => ((v - min) / (max - min)) * 100);
  const newData = data.map((d, i) => [d[0], d[1], norm[i]]);
  chart.setOption({ series: [{ data: newData }] });
}

export function resetBubble() {
  if (!originalBubbleData) return;
  const chart = echarts.getInstanceByDom(document.getElementById('chartBubble'));
  if (chart) chart.setOption({ series: [{ data: originalBubbleData }] });
}
// 마지막 줄 근처에 추가
export { resolveTheme };
