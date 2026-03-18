# DESCRIPTION
### ITP-Pyramidenrangliste
A WebApp to display the rankings of an internal school tabletennis competition.

### Techstack
Python Flask, SQLAlchemy

# INSTALLATION GUIDE
### Clone GIT-Repository
git clone https://github.com/MaierhoferKilian/ITP-Pyramidenrangliste.git

### Create Virtual Environment
python -m venv venv

venv\Scripts\activate

### Install Requirements
pip install -r requirements.txt

### Create .env
.env Datei hinzufügen: enthält das Client-Secret, daher nicht auf Github

Vorlage:

CLIENT_ID=d4740934-1c7c-4d35-ba18-eee83b8636ec

CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx

AUTHORITY=https://login.microsoftonline.com/6dd5291a-610e-4172-a7b6-9a7dc57e9a2a

REDIRECT_PATH=/getAToken

APP_BASE_URL=https://your-domain.example

FLASK_SECRET_KEY=your-long-random-secret

SCOPE=User.Read

Hinweis:
- Lokal kannst du APP_BASE_URL weglassen (dann wird automatisch die aktuelle Host-URL verwendet).
- In Produktion sollte APP_BASE_URL auf deine HTTPS-Domain gesetzt sein, damit die Redirect-URI exakt zu Azure passt.

### Azure Entra App Registration (echter Login)
In Azure Portal bei der bereits registrierten App:

1. Authentication:
- Plattform: `Web`
- Redirect URI (Produktion): `https://your-domain.example/getAToken`
- Optional Redirect URI (Lokal): `http://localhost:5000/getAToken`
- Front-channel logout URL: `https://your-domain.example/signed_out`

2. Certificates & Secrets:
- Stelle sicher, dass ein aktives Client Secret vorhanden ist
- Trage dieses als `CLIENT_SECRET` in deiner Umgebung ein

3. API permissions:
- Microsoft Graph Delegated Permission `User.Read`
- Danach `Grant admin consent` (falls von eurer Tenant-Policy gefordert)

4. Token configuration (optional):
- Für diese App nicht zwingend erforderlich

5. Supported account types:
- Single tenant: `Accounts in this organizational directory only`
	(empfohlen, wenn nur Schul-Accounts zugelassen werden sollen)

### Init database
flask db init

flask db migrate -m "Initial migration"

flask db upgrade

### Start app
python app.py

