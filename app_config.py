from dotenv import load_dotenv
import os

load_dotenv()  #LOKALE ENTWICKLUNG!!!

FLASK_SECRET_KEY = os.environ.get("FLASK_SECRET_KEY")
CLIENT_ID = os.environ.get("CLIENT_ID")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET") #IM PRODUKTIVSYSTEM HIER NICHT SPEICHERN (SONDERN ZB: AZURE KEY VAULT)
AUTHORITY = os.environ.get("AUTHORITY")
REDIRECT_PATH = os.environ.get("REDIRECT_PATH", "/getAToken")
APP_BASE_URL = os.environ.get("APP_BASE_URL")
SCOPE = os.environ.get("SCOPE", "User.Read").split()
SESSION_TYPE = "filesystem"
