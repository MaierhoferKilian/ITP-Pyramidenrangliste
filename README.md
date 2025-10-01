### DESCRIPTION ###
# ITP-Pyramidenrangliste
A WebApp to display the rankings of an internal school tabletennis competition. 

### INSTALLATION GUIDE ###
# Clone GIT-Repository
git clone https://github.com/MaierhoferKilian/ITP-Pyramidenrangliste.git

# Create Virtual Environment
python -m venv venv
venv\Scripts\activate

# Install Requirements
pip install -r requirements.txt

# Create .env
.env Datei hinzufügen: enthält das Client-Secret, daher nicht auf Github

Vorlage:

CLIENT_ID=d4740934-1c7c-4d35-ba18-eee83b8636ec
CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
AUTHORITY=https://login.microsoftonline.com/6dd5291a-610e-4172-a7b6-9a7dc57e9a2a
REDIRECT_PATH=/getAToken
SCOPE=User.Read

# Start app
python app.py

