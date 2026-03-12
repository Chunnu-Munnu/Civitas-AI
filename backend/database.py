from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
import os

# Using SQLite for local dev, easily swappable to PostgreSQL
SQLALCHEMY_DATABASE_URL = "sqlite:///./civitas.db"

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    panel_capacity = Column(Float, default=0.0)
    location = Column(String, nullable=True)
    green_coins = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Reading(Base):
    __tablename__ = "readings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    voltage = Column(Float)
    current = Column(Float)
    power = Column(Float)
    is_anomaly = Column(Boolean, default=False)
    ipfs_hash = Column(String, nullable=True)
    blockchain_tx = Column(String, nullable=True)

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
