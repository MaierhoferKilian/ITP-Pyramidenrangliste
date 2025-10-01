from dotenv import load_dotenv
import os

load_dotenv()  #LOKALE ENTWICKLUNG!!!

CLIENT_ID = os.environ.get("CLIENT_ID")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET") #IM PRODUKTIVSYSTEM HIER NICHT SPEICHERN (SONDERN ZB: AZURE KEY VAULT)
AUTHORITY = os.environ.get("AUTHORITY")
REDIRECT_PATH = os.environ.get("REDIRECT_PATH", "/getAToken")
SCOPE = os.environ.get("SCOPE", "User.Read").split()
SESSION_TYPE = "filesystem"
