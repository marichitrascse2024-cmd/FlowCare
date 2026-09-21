import logging
import pymysql
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

def init_mysql_db():
    """Attempt to create the MySQL database if it doesn't exist."""
    try:
        conn = pymysql.connect(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            charset='utf8mb4'
        )
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{settings.MYSQL_DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        conn.commit()
        conn.close()
        logger.info(f"MySQL Database '{settings.MYSQL_DB}' is ready.")
        return True
    except Exception as e:
        logger.warning(f"Could not initialize MySQL database directly: {e}")
        return False

def get_engine():
    """Create SQLAlchemy engine with MySQL or SQLite fallback."""
    mysql_ready = init_mysql_db()
    
    if mysql_ready or settings.DATABASE_URL.startswith("mysql"):
        try:
            db_url = settings.get_database_url()
            engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_recycle=3600,
                echo=False
            )
            # Test connection
            with engine.connect() as conn:
                pass
            logger.info("Successfully connected to MySQL database.")
            return engine
        except Exception as e:
            logger.error(f"Failed to connect to MySQL with URL. Falling back to SQLite for local development: {e}")
    
    # Fallback to SQLite
    import os
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "flowcare.db")).replace("\\", "/")
    sqlite_url = f"sqlite:///{db_path}"
    logger.info(f"Using SQLite database at {sqlite_url}")
    return create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False},
        echo=False
    )

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
