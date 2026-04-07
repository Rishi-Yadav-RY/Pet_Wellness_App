import sqlite3

def display_db():
    conn = sqlite3.connect('petwell.db')
    
    print("\n" + "="*40)
    print("=== PETS TABLE ===")
    print("="*40)
    pets = conn.execute("SELECT id, name, breed, age, diet_plan FROM pets").fetchall()
    
    for p in pets:
        print(f"ID: {p[0][:8]}... | Name: {p[1]} | Breed: {p[2]} | Age: {p[3]} | Diet: {p[4]}")
        
    print("\n" + "="*50)
    print("=== RECENT STATS (Last 5 Entries) ===")
    print("="*50)
    stats = conn.execute("SELECT pet_id, date, steps, sleep, weight FROM stats ORDER BY date DESC LIMIT 5").fetchall()
    
    for s in stats:
        print(f"Pet ID: {s[0][:8]}... | Date: {s[1]} | Steps: {s[2]} | Sleep: {s[3]}h | Weight: {s[4]}kg")
        
    conn.close()

if __name__ == "__main__":
    display_db()
