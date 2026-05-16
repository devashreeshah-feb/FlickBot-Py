const API_BASE = "https://flickbot.onrender.com"; // ✅ Replace with your deployed backend URL

const searchBtn = document.getElementById('searchBtn');
const titleInput = document.getElementById('titleInput');
const genreInput = document.getElementById('genreInput');
const yearInput = document.getElementById('yearInput');
const moviesGrid = document.getElementById('moviesGrid');

const popup = document.getElementById('popup');
const popupContent = document.getElementById('popupContent');
const closePopup = document.getElementById('closePopup');

// -------------------- MOVIE SEARCH --------------------
async function searchMovies() {
  moviesGrid.innerHTML = '<div class="note">Loading...</div>';
  const payload = {
    title: titleInput.value.trim(),
    genre: genreInput.value.trim(),
    year: yearInput.value.trim()
  };
  const r = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  renderMovies(data.results || []);
}

// -------------------- MOVIE GRID --------------------
function renderMovies(movies) {
  if (!movies || movies.length === 0) {
    moviesGrid.innerHTML = '<div class="note">No movies found. Try different filters.</div>';
    return;
  }
  moviesGrid.innerHTML = '';
  movies.forEach(m => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    const poster = m.poster_path
      ? `https://image.tmdb.org/t/p/w342${m.poster_path}`
      : 'https://via.placeholder.com/300x450?text=No+Image';
    card.innerHTML = `
      <img src="${poster}" alt="${escapeHtml(m.title)}" loading="lazy"/>
      <div class="title">${escapeHtml(m.title)}
        <div style="font-size:12px;color:#9aa6b2;margin-top:6px">
          ${m.release_date ? m.release_date.slice(0, 4) : ''}
        </div>
      </div>
    `;
    card.addEventListener('click', () => openMoviePopup(m.id));
    moviesGrid.appendChild(card);
  });
}

// -------------------- MOVIE POPUP --------------------
async function openMoviePopup(id) {
  popup.classList.remove('hidden');
  popupContent.innerHTML = '<div class="note">Loading details...</div>';
  const r = await fetch(`${API_BASE}/api/movie/${id}`);
  const data = await r.json();

  const poster = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
  let html = `
    <div style="display:flex;gap:18px">
      <div style="flex:0 0 200px">
        <img src="${poster}" style="width:100%;border-radius:8px" alt="poster"/>
      </div>
      <div style="flex:1">
        <h2>${escapeHtml(data.title || '')}
          <span style="color:#9aa6b2;font-size:14px">(${(data.release_date || '').slice(0, 4)})</span>
        </h2>
        <p style="color:#cbd6de">${escapeHtml(data.tagline || data.original_title || '')}</p>
        <p>${escapeHtml(data.overview || 'No overview available.')}</p>
        <p style="font-size:13px;color:#9aa6b2">
          Runtime: ${data.runtime || 'N/A'} mins • Rating: ${data.vote_average || 'N/A'} • Votes: ${data.vote_count || 0}
        </p>
        <div style="margin-top:12px"><strong>Genres:</strong> ${(data.genres || []).map(g => g.name).join(', ') || 'N/A'}</div>
        <div style="margin-top:12px"><strong>Cast:</strong> ${(data.credits && data.credits.cast ? data.credits.cast.slice(0, 6).map(c => c.name).join(', ') : 'N/A')}</div>
      </div>
    </div>
  `;

  if (data.videos && data.videos.results && data.videos.results.length) {
    const trailer = data.videos.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || data.videos.results[0];
    if (trailer) {
      html += `
        <div style="margin-top:16px">
          <strong>Trailer:</strong>
          <div style="margin-top:8px">
            <iframe width="100%" height="360" src="https://www.youtube.com/embed/${trailer.key}"
              frameborder="0" allowfullscreen></iframe>
          </div>
        </div>`;
    }
  }
  popupContent.innerHTML = html;
}
closePopup.addEventListener('click', () => popup.classList.add('hidden'));

// Escape HTML
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]
  );
}

// -------------------- INIT --------------------
searchBtn.addEventListener('click', searchMovies);
window.addEventListener('load', searchMovies);

// -------------------- GEMINI CHATBOT --------------------
// -------------------- GEMINI CHATBOT --------------------
const chatIcon = document.getElementById('chatIcon');
const chatPopup = document.getElementById('chatPopup');
const closeChat = document.getElementById('closeChat');
const chatbotInput = document.getElementById('chatbotInput');
const chatbotMessages = document.getElementById('chatbotMessages');
const sendChat = document.getElementById('sendChat');
const clearChat = document.getElementById('clearChat');

let chatHistory = JSON.parse(localStorage.getItem('flickbotChatHistory')) || [];
renderChatHistory();

function renderChatHistory() {
  chatbotMessages.innerHTML = '';
  chatHistory.forEach(msg => appendChatMsg(msg.role, msg.content, false));
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function saveChat() {
  localStorage.setItem('flickbotChatHistory', JSON.stringify(chatHistory));
}

// open/close popup
chatIcon.addEventListener('click', () => chatPopup.classList.toggle('hidden'));
closeChat.addEventListener('click', () => chatPopup.classList.add('hidden'));

// send message
async function handleSend() {
  const text = chatbotInput.value.trim();
  if (!text) return;

  appendChatMsg('user', text, false);
  chatbotInput.value = '';

  const placeholder = appendChatMsg('bot', 'Thinking...', false);

  try {
    const r = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await r.json();
    const reply = data.reply || 'No response.';

    // Convert **Movie Title** → clickable golden link
    let html = marked.parse(reply);
    html = html.replace(/\*\*(.*?)\*\*/g, `<strong class="movie-link" data-title="$1">$1</strong>`);

    placeholder.innerHTML = html;

    // reattach click handlers after rendering
    attachMovieLinkHandlers();

    // save chat
    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'bot', content: reply });
    saveChat();
  } catch (err) {
    placeholder.textContent = 'Error: ' + err.message;
  }

  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

sendChat.addEventListener('click', handleSend);
chatbotInput.addEventListener('keypress', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

clearChat.addEventListener('click', () => {
  chatbotMessages.innerHTML = '';
  chatHistory = [];
  localStorage.removeItem('flickbotChatHistory');
});

// Append chat messages
function appendChatMsg(who, text, save = true) {
  const div = document.createElement('div');
  div.className = 'chatbot-msg ' + who;

  if (who === 'bot') {
    let html = marked.parse(text);
    html = html.replace(/\*\*(.*?)\*\*/g, `<strong class="movie-link" data-title="$1">$1</strong>`);
    div.innerHTML = html;
  } else {
    div.textContent = text;
  }

  chatbotMessages.appendChild(div);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

  if (save) {
    chatHistory.push({ role: who, content: text });
    saveChat();
  }

  // attach click listeners
  attachMovieLinkHandlers();

  return div;
}

// 🔥 Handles clickable movie titles dynamically
function attachMovieLinkHandlers() {
  chatbotMessages.querySelectorAll(".movie-link").forEach(link => {
    link.style.color = "#FFD700";
    link.style.fontWeight = "600";
    link.style.cursor = "pointer";
    link.style.textDecoration = "underline";

    // remove previous listener (avoid duplicates)
    link.replaceWith(link.cloneNode(true));
  });

  chatbotMessages.querySelectorAll(".movie-link").forEach(link => {
    link.addEventListener("click", () => {
      const movieTitle = link.getAttribute("data-title");
      if (titleInput && searchBtn) {
        titleInput.value = movieTitle;
        searchBtn.click();
      }
    });
  });
}
