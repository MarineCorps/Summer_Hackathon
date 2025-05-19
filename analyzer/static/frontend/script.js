import {
  renderAllCharts,
  setThemePalette,
  normalizeBubble,
  resetBubble
} from './render_charts.js';

let selectedPalette = 'auto';
let allAnalysisResults = {}; // ✅ 여러 파일 결과 저장

// ✅ 테마 변경 이벤트
const paletteSelect = document.getElementById('paletteSelect');
paletteSelect?.addEventListener('change', () => {
  selectedPalette = paletteSelect.value;
  setThemePalette(selectedPalette);

  // 현재 활성 카드의 데이터를 다시 렌더링
  const activeCard = document.querySelector('.card.active');
  if (activeCard) {
    const filename = activeCard.dataset.filename;
    const result = allAnalysisResults[filename];
    if (result) {
      const resultBox = document.getElementById("resultBox");
      const gptBox = document.getElementById("gptSummary");
      const cards = document.getElementById("summaryCards");
      const scatterSelect = document.getElementById("scatterSelect");

      renderAllCharts(result, resultBox, gptBox, cards, scatterSelect);
    }
  }
});

// ✅ 전체 분석 실행
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

  const analysisType = document.getElementById("analysisType")?.value;
  const columns = document.getElementById("columnInput")?.value;
  const gptKey = document.getElementById("gptKey")?.value;
  const useGpt = document.getElementById("useGpt")?.checked;
  const timeColumn = document.getElementById("timeColumnInput")?.value;

  formData.append("analysis_type", analysisType);
  formData.append("columns", columns);
  formData.append("gpt_api_key", gptKey);
  formData.append("use_gpt", useGpt);
  formData.append("time_column", timeColumn);

  resultBox.textContent = "📡 분석 중...";
  resultBox.style.display = 'block';
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

    resultBox.style.display = 'none';
    allAnalysisResults = json;
    cards.innerHTML = '';

    const filenames = Object.keys(json);
    if (filenames.length === 0) {
      resultBox.textContent = "❌ 분석 결과가 없습니다.";
      return;
    }

    filenames.forEach((filename, index) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.textContent = `📄 분석 완료: ${filename}`;
      card.dataset.filename = filename;

      card.addEventListener('click', () => {
        // ✅ 모든 카드에서 active 제거
        document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));

        // ✅ 현재 카드에 active 추가
        card.classList.add('active');

        const result = allAnalysisResults[filename];
        const resultBox = document.getElementById("resultBox");
        const gptBox = document.getElementById("gptSummary");
        const scatterSelect = document.getElementById("scatterSelect");

        gptBox.value = result.gpt_summary || '';
        scatterSelect.innerHTML = '';
        renderAllCharts(result, resultBox, gptBox, cards, scatterSelect);
      });

      cards.appendChild(card);

      // ✅ 첫 번째 파일 자동 렌더링 + active 지정
      if (index === 0) {
        card.classList.add('active');
        const result = json[filename];
        gptBox.value = result.gpt_summary || '';
        renderAllCharts(result, resultBox, gptBox, cards, scatterSelect);
      }
    });

  } catch (err) {
    resultBox.style.display = 'block';
    resultBox.textContent = "❌ 예외 발생: " + err.message;
  }
});

// ✅ 버블 차트 정규화/복원 버튼 연결
document.getElementById('normalizeBubbleBtn')?.addEventListener('click', normalizeBubble);
document.getElementById('resetBubbleBtn')?.addEventListener('click', resetBubble);
