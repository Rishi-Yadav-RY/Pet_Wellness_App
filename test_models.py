import sqlite3
import requests
import json

def test():
    conn = sqlite3.connect('petwell.db')
    apikey = conn.execute("SELECT value FROM app_settings WHERE key='gemini_key'").fetchone()
    conn.close()
    
    if not apikey or not apikey[0]:
        print("No API key found in DB.")
        return
        
    key = apikey[0]
    res = requests.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}")
    
    if res.status_code == 200:
        data = res.json()
        print("SUPPORTED MODELS WITH generateContent:")
        for m in data.get('models', []):
            if 'generateContent' in m.get('supportedGenerationMethods', []):
                print(m['name'])
    else:
        print("Error fetching models:", res.text)

if __name__ == '__main__':
    test()
