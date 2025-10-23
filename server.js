// server.js
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const OMDB_API = "https://www.omdbapi.com/";
const API_KEY = "thewdb"; // free demo key

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  try {
    // Extract genre or keyword from user input
    const lowerMsg = message.toLowerCase();
    let searchQuery = "popular movies";

    if (lowerMsg.includes("romantic")) searchQuery = "romance";
    else if (lowerMsg.includes("horror")) searchQuery = "horror";
    else if (lowerMsg.includes("action")) searchQuery = "action";
    else if (lowerMsg.includes("comedy")) searchQuery = "comedy";
    else if (lowerMsg.includes("thriller")) searchQuery = "thriller";
    else if (lowerMsg.includes("science")) searchQuery = "science fiction";
    else if (lowerMsg.includes("drama")) searchQuery = "drama";

    // Search movies by type
    const searchUrl = `${OMDB_API}?s=${encodeURIComponent(searchQuery)}&type=movie&apikey=${API_KEY}`;
    const searchData = await axios.get(searchUrl);

    if (!searchData.data.Search) {
      return res.json({ reply: "Sorry, I couldn't find any movies for that genre." });
    }

    // Get details for first 5 results
    const movies = await Promise.all(
      searchData.data.Search.slice(0, 5).map(async (m) => {
        const detailUrl = `${OMDB_API}?i=${m.imdbID}&apikey=${API_KEY}`;
        const details = await axios.get(detailUrl);
        return {
          title: details.data.Title,
          year: details.data.Year,
          genre: details.data.Genre,
          plot: details.data.Plot,
          poster: details.data.Poster,
          imdb: `https://www.imdb.com/title/${details.data.imdbID}`,
        };
      })
    );

    res.json({
      reply: `Here are some ${searchQuery} movies you might enjoy:`,
      movies,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Error fetching movie data. Try again later." });
  }
});

app.listen(4000, () => console.log("✅ Server running at http://localhost:4000"));
