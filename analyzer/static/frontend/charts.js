// ✅ 시각화 색상 테마 팔레트 정의
export const colorPalettes = {
  accessibility: ['#377eb8', '#e41a1c', '#4daf4a', '#984ea3'],
  categorical: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'],
  diverging: ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'],
  sequential: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15']
};

function getColorPalette(theme) {
  return Array.isArray(colorPalettes[theme])
    ? colorPalettes[theme]
    : colorPalettes.accessibility;
}

function getChart(domId) {
  const container = document.getElementById(domId);
  if (!container) return null;
  echarts.dispose(container); // 기존 인스턴스 제거
  return echarts.init(container);
}

// ✅ 1. 막대그래프
export function drawBarChart(domId, labels, scores, theme = 'accessibility', title = "📈 상관관계 점수 (0.0 ~ 1.0)") {
  if (!labels.length || !scores.length) return;
  const chart = getChart(domId);
  if (!chart) return;

  const colors = getColorPalette(theme);

  chart.setOption({
    title: { text: title },
    tooltip: {
      formatter: (p) => `${p.name}<br/>상관계수: ${p.data}`
    },
    xAxis: { type: 'category', data: labels },
    yAxis: {
      type: 'value',
      max: 1,
      axisLabel: { formatter: (v) => v.toLocaleString() }
    },
    series: [{
      type: 'bar',
      data: scores,
      itemStyle: {
        color: (params) => colors[params.dataIndex % colors.length]
      }
    }]
  });
}

// ✅ 2. 산점도
export function drawScatterChart(domId, xVals, yVals, xLabel, yLabel, theme = 'accessibility') {
  if (!xVals?.length || !yVals?.length) return;
  const chart = getChart(domId);
  if (!chart) return;

  const colors = getColorPalette(theme);
  const data = xVals.map((x, i) => [x, yVals[i]]);

  chart.setOption({
    title: { text: `${xLabel} vs ${yLabel}` },
    tooltip: {
      trigger: 'item',
      formatter: (p) =>
        `${xLabel}: ${p.data[0]}<br>${yLabel}: ${p.data[1]}`
    },
    xAxis: { type: 'value', name: xLabel, axisLabel: { formatter: (v) => v.toLocaleString() } },
    yAxis: { type: 'value', name: yLabel, axisLabel: { formatter: (v) => v.toLocaleString() } },
    series: [{
      type: 'scatter',
      symbolSize: 10,
      data: data,
      itemStyle: { color: colors[0] }
    }]
  });
}

// ✅ 3. 히트맵
export function drawHeatmapChart(domId, results) {
  if (!results?.length) return;
  const chart = getChart(domId);
  if (!chart) return;

  const top = results.slice(0, 20);
  const x = [...new Set(top.map(r => r.col1))];
  const y = [...new Set(top.map(r => r.col2))];
  const data = top.map(r => [x.indexOf(r.col1), y.indexOf(r.col2), r.score]);

  chart.setOption({
    title: { text: '📊 상위 컬럼 쌍 히트맵' },
    tooltip: {
      formatter: (p) => `${x[p.data[0]]} ↔ ${y[p.data[1]]}<br/>상관계수: ${p.data[2]}`
    },
    xAxis: { type: 'category', data: x, axisLabel: { rotate: 45 } },
    yAxis: { type: 'category', data: y },
    visualMap: {
      min: 0,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0
    },
    series: [{
      name: '상관계수',
      type: 'heatmap',
      data: data,
      label: {
        show: true,
        formatter: (p) => p.data[2].toFixed(2)
      },
      emphasis: {
        itemStyle: {
          borderColor: '#333',
          borderWidth: 1
        }
      }
    }]
  });
}

// ✅ 4. 꺾은선 차트 (Line)
export function drawLineChart(domId, xVals, yVals, xLabel, yLabel, theme = 'accessibility') {
  // ✅ 유효성 검사
  if (!xVals?.length || !yVals?.length || xVals.length !== yVals.length) return;

  const chart = getChart(domId);
  if (!chart) return;

  const color = getColorPalette(theme)[0];

  chart.setOption({
    title: {
      text: `${xLabel} 에 따른 ${yLabel}`,
      left: 'center'
    },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: xVals, // ✅ 수정된 부분
      name: xLabel,
      axisLabel: {
        rotate: 45,
        interval: 'auto',
        overflow: 'truncate',
        formatter: function (value) {
          return value.length > 16 ? value.slice(0, 16) + '…' : value;
        }
      }
    },
    yAxis: {
      type: 'value',
      name: yLabel,
      axisLabel: {
        formatter: (v) => v.toLocaleString()
      }
    },
    series: [{
      type: 'line',
      data: yVals, // ✅ 그대로 유지
      smooth: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: color },
      itemStyle: { color: color },
      name: yLabel
    }],
    color: [color],
    backgroundColor: 'transparent'
  });
}

// ✅ 5. 박스플롯
export function drawBoxPlot(domId, dataList, labels, theme = 'accessibility') {
  if (!dataList?.length || !labels?.length) return;
  const chart = getChart(domId);
  if (!chart) return;

  const colors = getColorPalette(theme);

  chart.setOption({
    title: { text: '📦 박스플롯 (Box Plot)' },
    tooltip: { trigger: 'item' },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value', name: '값', axisLabel: { formatter: (v) => v.toLocaleString() } },
    series: [{

      type: 'boxplot',
      data: dataList,
      itemStyle: {
        color: (params) => colors[params.dataIndex % colors.length]
      }
    }]
  });
}

// ✅ 6. 버블차트 (Bubble)
export function drawBubbleChart(domId, x, y, size, xLabel, yLabel, theme = 'accessibility') {
  if (!x?.length || !y?.length || !size?.length) return;
  const chart = getChart(domId);
  if (!chart) return;

  const data = x.map((val, i) => [val, y[i], size[i]]);
  const color = getColorPalette(theme)[0];

  chart.setOption({
    title: { text: `${xLabel} vs ${yLabel} + 크기` },
    tooltip: {
      formatter: (p) =>
        `${xLabel}: ${p.data[0]}<br>${yLabel}: ${p.data[1]}<br>크기: ${p.data[2]}`
    },
    xAxis: { name: xLabel },
    yAxis: { name: yLabel },
    series: [{
      type: 'scatter',
      symbolSize: (data) => {
        const scaled = Math.sqrt(data[2]);
        return Math.min(100, Math.max(10, scaled / 2));
      },
      data: data,
      itemStyle: { color: color }
    }]
  });
}

// ✅ 7. 레이더차트 (Radar)
export function drawRadarChart(domId, indicators, valuesList, names, theme = 'accessibility') {
  if (!indicators?.length || !valuesList?.length || !names?.length) return;
  const chart = getChart(domId);
  if (!chart) return;

  const colors = getColorPalette(theme);

  chart.setOption({
    title: { text: '🧭 레이더차트' },
    tooltip: {},
    legend: { data: names },
    radar: {
      indicator: indicators,
      radius: '65%'
    },
    color: colors,
    series: [{
      type: 'radar',
      data: valuesList.map((val, i) => ({
        value: val,
        name: names[i]
      }))
    }]
  });
}

// ✅ 8. 도넛차트
export function drawPieChart(domId, labels, values, theme = 'accessibility', title = "🍩 카테고리 분포") {
  if (!labels?.length || !values?.length) return;
  const chart = getChart(domId);
  if (!chart) return;

  const colors = getColorPalette(theme);
  let data = labels.map((label, i) => ({ name: label, value: values[i] }));

  if (data.length > 12) {
    data.sort((a, b) => b.value - a.value);
    const top10 = data.slice(0, 10);
    const etcValue = data.slice(10).reduce((sum, d) => sum + d.value, 0);
    top10.push({ name: '기타', value: etcValue });
    data = top10;
  }

  chart.setOption({
    title: { text: title, left: 'center' },
    tooltip: { trigger: 'item' },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: data.map(d => d.name)
    },
    color: colors,
    series: [{
      name: '분포',
      type: 'pie',
      radius: ['40%', '70%'],
      data: data,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  });
}
