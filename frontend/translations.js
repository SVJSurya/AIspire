const translations = {
  en: {
    title: "🔍 Discover Your Career",
    subtitle: "Find the perfect job using AI-enabled semantic search (based on NCO 2015)",
    placeholder: "e.g., jobs for women in agriculture",
    searchBtn: "Search",
    langLabel: "हिन्दी",
    noQuery: "Please enter a search query.",
    noResults: "No matching jobs found.",
    error: "Something went wrong. Try again later.",
    codeLabel: "Code",
    confidenceLabel: "Confidence"
  },
  hi: {
    title: "🔍 अपना करियर खोजें",
    subtitle: "AI-सक्षम सर्च के माध्यम से सही नौकरी खोजें (NCO 2015 पर आधारित)",
    placeholder: "जैसे, कृषि में महिलाओं के लिए नौकरियाँ",
    searchBtn: "खोजें",
    langLabel: "English",
    noQuery: "कृपया एक खोज क्वेरी दर्ज करें।",
    noResults: "कोई मिलती-जुलती नौकरियाँ नहीं मिलीं।",
    error: "कुछ गलत हो गया। बाद में पुनः प्रयास करें।",
    codeLabel: "कोड",
    confidenceLabel: "विश्वास"
  }
};

let currentLang = "en";
let currentResultsEn = [];
let currentResultsHi = [];

// Add CSS for Devanagari font
function addHindiFontCSS() {
  const styleId = "devanagari-font-style";
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .code, .desc, .confidence {
      font-family: "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", sans-serif;
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);
}

// Convert digits to Hindi
function toHindiDigits(str) {
  if (!str) return "";
  str = String(str);
  const hindiDigits = ['०','१','२','३','४','५','६','७','८','९'];
  return str.replace(/\d/g, d => hindiDigits[d]);
}

// Google Translate API call
async function translateText(text, targetLang) {
  const res = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
  );
  const json = await res.json();
  return json[0].map(item => item[0]).join("");
}

// Translate all job results to Hindi
async function translateResultsToHindi(results) {
  const translated = [];
  for (const job of results) {
    translated.push({
      ...job,
      title: await translateText(job.title, "hi"),
      description: await translateText(job.description || "", "hi")
    });
  }
  return translated;
}

// Toggle language
function toggleLanguage() {
  currentLang = currentLang === "en" ? "hi" : "en";
  updateUI();
  renderResults();
}

// Update static UI text
function updateUI() {
  const t = translations[currentLang];
  document.getElementById("title-text").innerText = t.title;
  document.getElementById("subtitle-text").innerText = t.subtitle;
  document.getElementById("query-input").placeholder = t.placeholder;
  document.querySelector(".search-bar button:last-child").innerText = t.searchBtn;
  document.getElementById("lang-label").innerText = t.langLabel;

  if (currentLang === "hi") {
    addHindiFontCSS();
  }
}

// Perform search
async function performSearch() {
  const query = document.getElementById("query-input").value.trim();
  const resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = "";

  if (!query) {
    resultsContainer.innerHTML = `<p>${translations[currentLang].noQuery}</p>`;
    return;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:5000/search?query=${encodeURIComponent(query)}&lang=en`
    );
    const data = await response.json();

    if (data.error || data.length === 0) {
      resultsContainer.innerHTML = `<p>${translations[currentLang].noResults}</p>`;
      return;
    }

    // Store English results
    currentResultsEn = data;
    // Pre-translate to Hindi
    currentResultsHi = await translateResultsToHindi(data);

    renderResults();
  } catch (err) {
    resultsContainer.innerHTML = `<p>${translations[currentLang].error}</p>`;
    console.error(err);
  }
}

// Render job cards
function renderResults() {
  const resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = "";

  const t = translations[currentLang];
  const displayResults = currentLang === "en" ? currentResultsEn : currentResultsHi;

  displayResults.forEach(job => {
    const codeText = currentLang === "hi" ? toHindiDigits(job.code || "") : (job.code || "");
    const descText = currentLang === "hi" ? toHindiDigits(job.description || "") : (job.description || "");
    const confText = currentLang === "hi" ? toHindiDigits(job.confidence_score || "") : (job.confidence_score || "");

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${job.title}</h3>
      <p class="code">${t.codeLabel}: ${codeText}</p>
      <p class="desc">${descText}</p>
      <p class="confidence">${t.confidenceLabel}: ${confText}%</p>
    `;
    resultsContainer.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", updateUI);
