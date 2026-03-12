from pydantic import BaseModel
from typing import Optional, List

class UserBase(BaseModel):
    wallet_address: str
    name: Optional[str] = None
    panel_capacity: Optional[float] = 0.0
    location: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserSchema(UserBase):
    id: int
    green_coins: float

    class Config:
        from_attributes = True

class ReadingBase(BaseModel):
    voltage: float
    current: float
    power: float
    wallet_address: str

class ReadingCreate(ReadingBase):
    timestamp: float

class ReadingSchema(ReadingBase):
    id: int
    is_anomaly: bool
    ipfs_hash: Optional[str] = None
    blockchain_tx: Optional[str] = None

    class Config:
        from_attributes = True
