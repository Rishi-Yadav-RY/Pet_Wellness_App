import sqlite3
import requests

def test_weather():
    conn = sqlite3.connect('petwell.db')
    apikey = conn.execute("SELECT value FROM app_settings WHERE key='openweather_key'").fetchone()
    city = conn.execute("SELECT value FROM app_settings WHERE key='weather_city'").fetchone()
    conn.close()

    if not apikey or not apikey[0] or not city or not city[0]:
        print("Missing API key or city in database.")
        return

    url = f"https://api.openweathermap.org/data/2.5/weather?q={city[0]}&appid={apikey[0]}&units=metric"
    res = requests.get(url)
    
    print(f"Status Code: {res.status_code}")
    print(f"Response: {res.text}")

if __name__ == '__main__':
    test_weather()
