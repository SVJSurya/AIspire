// 🌐 BACKEND URL (change if needed)
const BACKEND_URL = "http://127.0.0.1:5000/search";

// 🔍 Perform search
async function performSearch() {
  const query = document.getElementById("query-input").value.trim();
  const resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = "";

  if (!query) {
    resultsContainer.innerHTML = "<p>Please enter a search query.</p>";
    return;
  }

  try {
    const response = await fetch(${BACKEND_URL}?query=${encodeURIComponent(query)});
    const data = await response.json();

    if (data.error || data.length === 0) {
      resultsContainer.innerHTML = "<p>No matching jobs found.</p>";
      return;
    }

    // Render result cards
    data.forEach(job => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <h3>${job.title}</h3>
        <p class="code">Code: ${job.code}</p>
        <p class="score">Confidence Score: ${job.confidence_score !== undefined ? job.confidence_score + "%" : "N/A"}</p>
        <p class="desc">${job.description}</p>
      `;

      resultsContainer.appendChild(card);
    });
  } catch (error) {
    resultsContainer.innerHTML = "<p>Something went wrong. Try again later.</p>";
    console.error("Search error:", error);
  }
}

// 🎙 Voice Input Support
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = "en-IN"; // Default to English
recognition.interimResults = false;
recognition.maxAlternatives = 1;

document.getElementById("voice-btn").addEventListener("click", () => {
  recognition.start();
});

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  document.getElementById("query-input").value = transcript;
  performSearch(); // Auto trigger search
};

recognition.onerror = (err) => {
  console.error("Voice error:", err);
  alert("Voice input failed. Please try again.");
};

// 🈳 Toggle Language (Hindi ↔ English)
function toggleLanguage() {
  const checkbox = document.getElementById("lang-toggle-checkbox");
  const label = document.getElementById("lang-label");

  if (checkbox.checked) {
    recognition.lang = "hi-IN"; // Switch to Hindi
    label.textContent = "English";
  } else {
    recognition.lang = "en-IN"; // Switch to English
    label.textContent = "हिन्दी";
  }
}

function toggleContrast() {
  document.body.classList.toggle("high-contrast");
}