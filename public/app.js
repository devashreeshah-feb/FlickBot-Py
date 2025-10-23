const chatbox = document.getElementById("chatbox");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;
  appendMessage("user", message);
  input.value = "";

  appendMessage("bot", "Searching for movies...");

  const res = await fetch("https://moviebot-1uev.onrender.com/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  const data = await res.json();
  displayBotResponse(data);
}

function appendMessage(sender, text) {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  div.innerHTML = text;
  chatbox.appendChild(div);
  chatbox.scrollTop = chatbox.scrollHeight;
}

function displayBotResponse(data) {
  chatbox.innerHTML += `<div class="message bot">${data.reply}</div>`;

  if (data.movies) {
    data.movies.forEach((m) => {
      const card = document.createElement("div");
      card.className = "movie-card";
      card.innerHTML = `
        <img src="${m.poster}" alt="${m.title}">
        <div>
          <strong>${m.title}</strong> (${m.year})<br>
          <em>${m.genre}</em><br>
          <p>${m.plot}</p>
          <a href="${m.imdb}" target="_blank">View on IMDb</a>
        </div>`;
      chatbox.appendChild(card);
    });
  }

  chatbox.scrollTop = chatbox.scrollHeight;
}
