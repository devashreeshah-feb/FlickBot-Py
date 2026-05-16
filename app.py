import os
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

PORT = int(os.getenv("PORT", 3000))
TMDB_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE = 'https://api.themoviedb.org/3'
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

genre_cache = None

def fetch_json(url, params=None, headers=None, method='GET', json_data=None):
    if method == 'GET':
        res = requests.get(url, params=params, headers=headers)
    elif method == 'POST':
        res = requests.post(url, params=params, headers=headers, json=json_data)
    else:
        raise ValueError("Unsupported method")
    
    if not res.ok:
        raise Exception(f"HTTP {res.status_code}: {res.text}")
    return res.json()

@app.route('/api/genres', methods=['GET'])
def get_genres():
    global genre_cache
    try:
        if genre_cache:
            return jsonify(genre_cache)
        
        url = f"{TMDB_BASE}/genre/movie/list"
        params = {"api_key": TMDB_KEY, "language": "en-US"}
        data = fetch_json(url, params=params)
        genre_cache = data
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/search', methods=['POST'])
def search_movies():
    global genre_cache
    try:
        req_data = request.get_json() or {}
        title = req_data.get('title', '').strip()
        genre = req_data.get('genre')
        year = req_data.get('year')
        
        print(f"[SEARCH] title='{title}', genre='{genre}', year='{year}'")

        if title:
            params = {
                "api_key": TMDB_KEY,
                "query": title,
                "language": "en-US",
                "page": "1",
                "include_adult": "false"
            }
            if year:
                params["year"] = str(year)
            
            url = f"{TMDB_BASE}/search/movie"
            data = fetch_json(url, params=params)
            
            results = data.get('results', [])
            if year:
                results = [m for m in results if m.get('release_date') and m['release_date'].startswith(str(year))]
            
            data['results'] = results
            return jsonify(data)
        
        # Discover movies
        params = {
            "api_key": TMDB_KEY,
            "language": "en-US",
            "sort_by": "popularity.desc",
            "include_adult": "false",
            "page": "1"
        }
        
        if year:
            params["primary_release_date.gte"] = f"{year}-01-01"
            params["primary_release_date.lte"] = f"{year}-12-31"
            
        if genre:
            if not genre_cache:
                g_url = f"{TMDB_BASE}/genre/movie/list"
                g_params = {"api_key": TMDB_KEY, "language": "en-US"}
                genre_cache = fetch_json(g_url, params=g_params)
                
            found = next((g for g in genre_cache.get('genres', []) if g['name'].lower() == str(genre).lower()), None)
            if found:
                params['with_genres'] = str(found['id'])
            elif str(genre).isdigit():
                params['with_genres'] = str(genre)
                
        url = f"{TMDB_BASE}/discover/movie"
        print(f"[DISCOVER URL] {url}")
        data = fetch_json(url, params=params)
        return jsonify(data)

    except Exception as e:
        print(f"[SEARCH ERROR] {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/movie/<path:id>', methods=['GET'])
def get_movie(id):
    try:
        url = f"{TMDB_BASE}/movie/{id}"
        params = {
            "api_key": TMDB_KEY,
            "language": "en-US",
            "append_to_response": "videos,images,credits"
        }
        data = fetch_json(url, params=params)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        req_data = request.get_json() or {}
        message = req_data.get('message')
        if not message:
            return jsonify({"error": "No message provided"}), 400
        
        endpoint = f"https://generativelanguage.googleapis.com/v1/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
        
        body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": f"You are FlickBot, a helpful movie assistant. Reply concisely and use **Markdown** formatting (bold, lists, line breaks) for readability.\n\nUser: {message}"
                        }
                    ]
                }
            ]
        }
        
        res = fetch_json(endpoint, method='POST', json_data=body)
        
        try:
            bot_reply = res['candidates'][0]['content']['parts'][0]['text']
        except (KeyError, IndexError):
            bot_reply = "No response from model"
            
        return jsonify({"reply": bot_reply})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(port=PORT, debug=True)
