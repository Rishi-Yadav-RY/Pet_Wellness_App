import sqlite3
import requests
import sys

def main():
    conn = sqlite3.connect('petwell.db')
    apikey = conn.execute("SELECT value FROM app_settings WHERE key='gemini_key'").fetchone()
    conn.close()
    
    key = apikey[0]
    res = requests.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}")
    data = res.json()
    
    valid = []
    for m in data.get('models', []):
        if 'generateContent' in m.get('supportedGenerationMethods', []):
            valid.append(m['name'].replace('models/', ''))
            
    print(", ".join(valid[:5]))

if __name__ == '__main__':
    main()
