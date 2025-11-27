// 🌐 BACKEND URL
const BACKEND_URL = "http://127.0.0.1:5000/search";

// 🌐 Search for accessible jobs
async function searchAccessibleJobs() {
  const query = document.getElementById("accessible-query").value.trim();
  const resultsContainer = document.getElementById("accessible-results");
  resultsContainer.innerHTML = "";

  if (!query) {
    resultsContainer.innerHTML = "<p>Please enter a search query.</p>";
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}?query=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (data.error || data.length === 0) {
      resultsContainer.innerHTML = "<p>No matching jobs found.</p>";
      return;
    }

    let resultText = "";
    data.forEach((job) => {
      resultText += `\n${job.title} (Confidence: ${job.confidence_score}%). Code: ${job.code}. ${job.description}\n`;
      resultsContainer.innerHTML += `
        <div class="card">
          <h3>${job.title}</h3>
          <p class="code">Code: ${job.code}</p>
          <p class="score">Confidence Score: ${job.confidence_score}%</p>
          <p class="desc">${job.description}</p>
        </div>
      `;
    });

    // Save for TTS
    window.accessibleTTS = resultText;

  } catch (err) {
    console.error("Error searching jobs:", err);
    resultsContainer.innerHTML = "<p>Something went wrong. Please try again.</p>";
  }
}

// 🔊 Text-to-Speech
function readResultsAloud() {
  if (!window.accessibleTTS) {
    alert("No results to read.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(window.accessibleTTS);
  utterance.lang = document.getElementById("lang-dis-toggle").checked ? "hi-IN" : "en-IN";
  speechSynthesis.cancel(); // Stop previous speech
  speechSynthesis.speak(utterance);
}

// 🌐 Language Toggle
function toggleLangDis() {
  const label = document.getElementById("lang-dis-label");
  const isHindi = document.getElementById("lang-dis-toggle").checked;
  label.textContent = isHindi ? "English" : "हिन्दी";
}

// 🌗 High Contrast Mode
function toggleContrast() {
  document.body.classList.toggle("high-contrast");
  document.querySelector("main").classList.toggle("high-contrast");
  document.getElementById("accessible-results").classList.toggle("high-contrast");
}