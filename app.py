import os
import json
import uuid
import random
import requests
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DEFAULT_AVATAR = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80"

def get_db_url():
    return (os.environ.get('POSTGRES_URL') or 
            os.environ.get('DATABASE_URL') or 
            os.environ.get('SUPABASE_DB_URL') or 
            os.environ.get('supabase-cinnabar-horizon') or 
            os.environ.get('SUPABASE_CINNABAR_HORIZON') or 
            os.environ.get('SUPABASE_CINNABAR_HORIZON_URL'))

def exec_query(query, params=(), commit=False, fetchone=False, fetchall=False):
    db_url = get_db_url()
    
    if db_url:
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        query = query.replace('?', '%s')
    else:
        import sqlite3
        conn = sqlite3.connect('petwell.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
    cursor.execute(query, params)
    
    result = None
    if fetchone:
        row = cursor.fetchone()
        result = dict(row) if row else None
    elif fetchall:
        rows = cursor.fetchall()
        result = [dict(r) for r in rows] if rows else []
        
    if commit:
        conn.commit()
    conn.close()
    return result

def init_db():
    if get_db_url():
        # Postgres init
        queries = [
            "CREATE TABLE IF NOT EXISTS pets (id TEXT PRIMARY KEY, name TEXT, breed TEXT, age INTEGER, avatar_url TEXT, diet_plan TEXT, daily_step_goal INTEGER)",
            "CREATE TABLE IF NOT EXISTS stats (id SERIAL PRIMARY KEY, pet_id TEXT REFERENCES pets(id), date TEXT, steps INTEGER, sleep REAL, weight REAL, hydration INTEGER)",
            "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)"
        ]
        for q in queries:
            exec_query(q, commit=True)
            
        count = exec_query("SELECT count(*) as cx FROM pets", fetchone=True)['cx']
    else:
        # DB setup for SQLite
        exec_query("CREATE TABLE IF NOT EXISTS pets (id TEXT PRIMARY KEY, name TEXT, breed TEXT, age INTEGER, avatar_url TEXT, diet_plan TEXT, daily_step_goal INTEGER)", commit=True)
        exec_query("CREATE TABLE IF NOT EXISTS stats (id INTEGER PRIMARY KEY AUTOINCREMENT, pet_id TEXT REFERENCES pets(id), date TEXT, steps INTEGER, sleep REAL, weight REAL, hydration INTEGER)", commit=True)
        exec_query("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)", commit=True)
        count = exec_query("SELECT count(*) as cx FROM pets", fetchone=True)['cx']

    # Seed data if empty
    if count == 0:
        pet_id = str(uuid.uuid4())
        exec_query("INSERT INTO pets (id, name, breed, age, avatar_url, diet_plan, daily_step_goal) VALUES (?,?,?,?,?,?,?)",
                  (pet_id, "Buddy", "Golden Retriever", 4, DEFAULT_AVATAR, "Maintenance Plan", 10000), commit=True)
        
        today = datetime.now()
        for i in range(7):
            day = (today - timedelta(days=6-i)).strftime('%Y-%m-%d')
            exec_query("INSERT INTO stats (pet_id, date, steps, sleep, weight, hydration) VALUES (?,?,?,?,?,?)",
                      (pet_id, day, random.randint(5000, 11000), random.uniform(10.5, 14.0), 32.5, random.randint(400, 800)), commit=True)

init_db()

@app.route('/api/pets', methods=['GET'])
def get_pets():
    pets = exec_query("SELECT * FROM pets", fetchall=True)
    for pet in pets:
        stats = exec_query("SELECT * FROM stats WHERE pet_id = ? ORDER BY date ASC LIMIT 7", (pet['id'],), fetchall=True)
        labels, steps, sleep, weight = [], [], [], []
        latest_hydration = 0
        for s in stats:
            date_obj = datetime.strptime(s['date'], '%Y-%m-%d')
            labels.append(date_obj.strftime('%a'))
            steps.append(s['steps'])
            sleep.append(round(s['sleep'], 1))
            weight.append(round(s['weight'], 1))
            latest_hydration = s['hydration']
            
        pet['historicalData'] = {
            'labels': labels, 'steps': steps, 'sleep': sleep, 'weight': weight, 'latest_hydration': latest_hydration
        }
    return jsonify(pets)

@app.route('/api/pets', methods=['POST'])
def add_pet():
    data = request.json
    pet_id = str(uuid.uuid4())
    avatar_url = data.get('avatarBase64') or DEFAULT_AVATAR
    
    exec_query("INSERT INTO pets (id, name, breed, age, avatar_url, diet_plan, daily_step_goal) VALUES (?,?,?,?,?,?,?)",
              (pet_id, data.get('name'), data.get('breed'), data.get('age'), avatar_url, "Maintenance Plan", 8000), commit=True)
    
    today = datetime.now()
    for i in range(7):
        day = (today - timedelta(days=6-i)).strftime('%Y-%m-%d')
        exec_query("INSERT INTO stats (pet_id, date, steps, sleep, weight, hydration) VALUES (?,?,?,?,?,?)",
                  (pet_id, day, random.randint(3000, 6000), random.uniform(11, 15), 15.0, random.randint(300, 600)), commit=True)
    
    return jsonify({"success": True, "id": pet_id})

@app.route('/api/pets/<pet_id>', methods=['PUT'])
def update_pet(pet_id):
    data = request.json
    field = data.get('field')
    value = data.get('value')
    if field not in ['name', 'breed', 'age', 'daily_step_goal']:
        return jsonify({"error": "Invalid field"}), 400
        
    exec_query(f"UPDATE pets SET {field} = ? WHERE id = ?", (value, pet_id), commit=True)
    return jsonify({"success": True})

@app.route('/api/pets/<pet_id>/avatar', methods=['POST'])
def change_avatar(pet_id):
    avatar_base64 = request.json.get('avatarBase64')
    if not avatar_base64: return jsonify({"error": "No file"}), 400
    
    exec_query("UPDATE pets SET avatar_url = ? WHERE id = ?", (avatar_base64, pet_id), commit=True)
    return jsonify({"success": True})

@app.route('/api/pets/<pet_id>/diet', methods=['PUT'])
def update_diet(pet_id):
    plan = request.json.get('plan')
    exec_query("UPDATE pets SET diet_plan = ? WHERE id = ?", (plan, pet_id), commit=True)
    return jsonify({"success": True})

@app.route('/api/pets/<pet_id>/sync', methods=['POST'])
def sync_stats(pet_id):
    try:
        row = exec_query("SELECT weight FROM stats WHERE pet_id = ? ORDER BY date DESC LIMIT 1", (pet_id,), fetchone=True)
        current_weight = float(row['weight']) if row and row.get('weight') is not None else 15.0
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        new_steps = random.randint(4000, 12000)
        new_sleep = round(random.uniform(10.0, 14.5), 1)
        new_hydration = random.randint(300, 800)
        new_weight = round(current_weight + random.uniform(-0.2, 0.2), 1)
        
        exists = exec_query("SELECT id FROM stats WHERE pet_id = ? AND date = ?", (pet_id, today_str), fetchone=True)
        if exists:
            exec_query("UPDATE stats SET steps=?, sleep=?, weight=?, hydration=? WHERE id=?", 
                         (new_steps, new_sleep, new_weight, new_hydration, exists['id']), commit=True)
        else:
            exec_query("INSERT INTO stats (pet_id, date, steps, sleep, weight, hydration) VALUES (?,?,?,?,?,?)",
                         (pet_id, today_str, new_steps, new_sleep, new_weight, new_hydration), commit=True)
        return jsonify({"success": True, "steps": new_steps, "sleep": new_sleep, "weight": new_weight, "hydration": new_hydration})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/pets/<pet_id>', methods=['DELETE'])
def delete_pet(pet_id):
    exec_query("DELETE FROM stats WHERE pet_id = ?", (pet_id,), commit=True)
    exec_query("DELETE FROM pets WHERE id = ?", (pet_id,), commit=True)
    return jsonify({"success": True})

@app.route('/api/settings', methods=['GET'])
def get_settings():
    rows = exec_query("SELECT key, value FROM app_settings", fetchall=True)
    return jsonify({r['key']: r['value'] for r in rows})

@app.route('/api/settings', methods=['POST'])
def save_setting():
    data = request.json
    key = data.get('key')
    value = data.get('value')
    # Postgres uses ON CONFLICT (key) DO UPDATE. SQLite handles it natively via INSERT OR REPLACE
    if get_db_url():
        exec_query("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=?", (key, value, value), commit=True)
    else:
        exec_query("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=?", (key, value, value), commit=True)
    return jsonify({"success": True})

@app.route('/api/weather', methods=['GET'])
def get_weather():
    apikey = exec_query("SELECT value FROM app_settings WHERE key='openweather_key'", fetchone=True)
    city = exec_query("SELECT value FROM app_settings WHERE key='weather_city'", fetchone=True)
    
    if not apikey or not city or not apikey['value'] or not city['value']:
        return jsonify({"error": "Missing API Key or City in Settings"}), 400
        
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?q={city['value']}&appid={apikey['value']}&units=metric"
        res = requests.get(url).json()
        if res.get('cod') != 200: return jsonify({"error": res.get('message', 'Weather error')}), 400
        return jsonify({ "temp": round(res['main']['temp']), "condition": res['weather'][0]['main'], "desc": res['weather'][0]['description'], "icon": res['weather'][0]['icon'] })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/pets/<pet_id>/ai-insights', methods=['POST'])
def get_ai_insights(pet_id):
    apikey = exec_query("SELECT value FROM app_settings WHERE key='gemini_key'", fetchone=True)
    if not apikey or not apikey['value']: return jsonify({"error": "Missing Gemini API Key."}), 400
        
    pet = exec_query("SELECT * FROM pets WHERE id=?", (pet_id,), fetchone=True)
    stats = exec_query("SELECT * FROM stats WHERE pet_id=? ORDER BY date DESC LIMIT 7", (pet_id,), fetchall=True)
    
    history = "\n".join([f"Date: {s['date']}, Steps: {s['steps']}, Sleep: {s['sleep']}h, Hydration: {s['hydration']}ml, Weight: {s['weight']}kg" for s in stats])
    prompt = f"You are an energetic Vet for PetWellness App. Here is 7-day data for {pet['name']} the {pet['breed']} (Age {pet['age']}, Diet: {pet['diet_plan']}).\nData:\n{history}\nWrite ONE paragraph engaging advice."

    try:
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apikey['value']}"
        res = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        res_data = res.json()
        
        if 'error' in res_data:
            return jsonify({"error": res_data['error'].get('message', 'Gemini API Error')}), 400
            
        advice = res_data['candidates'][0]['content']['parts'][0]['text'].strip()
        return jsonify({"advice": advice})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
