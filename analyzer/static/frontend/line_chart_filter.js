import { drawLineChart } from './charts.js';
import { resolveTheme } from './render_charts.js';

export function setupLineChartFilter(json) {
  const select = document.getElementById('lineViewSelect');
  const hourlyDateSelect = document.getElementById('hourlyDateSelect');
  const hourlyDateWrapper = document.getElementById('hourlyDateWrapper'); // ✅ 추가

  if (!select || !json.line_data) return;

  const draw = () => {
    const mode = select.value;

    // ✅ 시간대별 날짜 기반 분석
    if (mode === 'hourly' && json.line_hourly_by_date && hourlyDateSelect && hourlyDateWrapper) {
      // 👉 날짜 선택 박스 표시
      hourlyDateWrapper.style.display = 'block';

      // 1. 날짜 옵션 초기화
      hourlyDateSelect.innerHTML = '';
      const dates = Object.keys(json.line_hourly_by_date).sort();

      dates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date;
        hourlyDateSelect.appendChild(option);
      });

      // 2. 날짜 선택 시 → 해당 24개 값으로 draw
      const renderHourly = () => {
        const selectedDate = hourlyDateSelect.value;
        const y = json.line_hourly_by_date[selectedDate];
        const x = Array.from({ length: 24 }, (_, i) => `${i}시`);
        drawLineChart('chartLine', x, y, '시간대', json.line_data.yLabel, resolveTheme('line'));
      };

      hourlyDateSelect.removeEventListener('change', renderHourly);
      hourlyDateSelect.addEventListener('change', renderHourly);
      renderHourly();
    } else {
      // 📌 다른 모드일 경우 날짜 선택 박스 숨기기
      if (hourlyDateWrapper) hourlyDateWrapper.style.display = 'none';

      const grouped = {};
      json.line_data.x.forEach((xVal, i) => {
        const date = new Date(xVal);
        let key = '';
        if (mode === 'daily') {
          key = date.toISOString().split('T')[0];
        } else if (mode === 'monthly') {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(json.line_data.y[i]);
      });

      const labels = Object.keys(grouped).sort();
      const values = labels.map(k => {
        const arr = grouped[k];
        return arr.reduce((a, b) => a + b, 0) / arr.length;
      });

      const xLabel = mode === 'monthly' ? '월' : '날짜';
      drawLineChart('chartLine', labels, values, xLabel, json.line_data.yLabel, resolveTheme('line'));
    }
  };

  select.removeEventListener('change', draw);
  select.addEventListener('change', draw);
  draw();
}
