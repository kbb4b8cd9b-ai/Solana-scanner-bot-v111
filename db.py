import json
from datetime import datetime,timezone
from sqlalchemy import create_engine,Column,Integer,String,Text,DateTime
from sqlalchemy.orm import declarative_base,sessionmaker
from .settings import settings
connect_args={"check_same_thread":False} if settings.database_url.startswith("sqlite") else {}
engine=create_engine(settings.database_url,connect_args=connect_args)
Base=declarative_base()
SessionLocal=sessionmaker(bind=engine)
class Scan(Base):
    __tablename__="scans"
    id=Column(Integer,primary_key=True)
    mint=Column(String(64),nullable=False)
    risk_score=Column(Integer,nullable=False)
    risk_level=Column(String(16),nullable=False)
    payload=Column(Text,nullable=False)
    created_at=Column(DateTime,default=lambda:datetime.now(timezone.utc))
def init_db(): Base.metadata.create_all(engine)
def save_scan(data):
    db=SessionLocal()
    try:
        x=Scan(mint=data["mint"],risk_score=data["risk_score"],risk_level=data["risk_level"],payload=json.dumps(data))
        db.add(x);db.commit()
    finally: db.close()
