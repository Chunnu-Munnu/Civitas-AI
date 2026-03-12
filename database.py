import sqlite3
import time

def init_db():
    conn = sqlite3.connect("users.db")
    c = conn.cursor()

    # User Table
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT,
            coins REAL DEFAULT 0
        )
    """)

    # Readings Table (New)
    c.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            timestamp REAL,
            voltage REAL,
            current REAL,
            power REAL,
            is_anomaly INTEGER,
            coins_earned REAL
        )
    """)

    conn.commit()
    conn.close()


def create_user(name, phone):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("INSERT INTO users (name, phone) VALUES (?, ?)", (name, phone))
    conn.commit()
    user_id = c.lastrowid
    conn.close()
    return user_id


def get_user(user_id):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE id=?", (user_id,))
    user = c.fetchone()
    conn.close()
    return user


def update_coins(user_id, coins):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("UPDATE users SET coins=? WHERE id=?", (coins, user_id))
    conn.commit()
    conn.close()

def log_reading(user_id, voltage, current, power, is_anomaly, coins_earned):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    timestamp = time.time()
    c.execute("""
        INSERT INTO readings (user_id, timestamp, voltage, current, power, is_anomaly, coins_earned)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, timestamp, voltage, current, power, is_anomaly, coins_earned))
    conn.commit()
    conn.close()

def get_history(user_id, limit=50):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT timestamp, voltage, current, power, is_anomaly FROM readings WHERE user_id=? ORDER BY id DESC LIMIT ?", (user_id, limit))
    data = c.fetchall()
    conn.close()
    return data[::-1]  # Reverse to chronological order
