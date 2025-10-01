from flask import Flask, render_template, url_for, session, redirect, request
import msal, os, requests
from app_config import CLIENT_ID, CLIENT_SECRET, AUTHORITY, REDIRECT_PATH, SCOPE, SESSION_TYPE

app = Flask(__name__)
app.config.from_object("app_config")
app.secret_key = os.urandom(24)

# Login
def _build_msal_app(cache=None):
    if cache is None:
        cache = msal.SerializableTokenCache()
    return msal.ConfidentialClientApplication(
        CLIENT_ID,
        authority=AUTHORITY,
        client_credential=CLIENT_SECRET,
        token_cache=cache
    )

def _build_auth_url():
    return _build_msal_app().get_authorization_request_url(
        SCOPE,
        redirect_uri=f"http://localhost:5000{REDIRECT_PATH}"
    )

def _get_token_from_cache():
    cache = msal.SerializableTokenCache()
    if session.get("token_cache"):
        cache.deserialize(session["token_cache"])
    cca = _build_msal_app(cache)
    accounts = cca.get_accounts()
    if accounts:
        result = cca.acquire_token_silent(SCOPE, account=accounts[0])
        session["token_cache"] = cache.serialize()
        return result

def get_user_graph_data(access_token):
    graph_endpoint = "https://graph.microsoft.com/v1.0/me"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(graph_endpoint, headers=headers)
    if response.status_code == 200:
        return response.json()
    return {}

# Routes
@app.route("/")
def index():
    if not session.get("user"):
        return redirect(url_for("login"))
    return render_template("index.html", user=session["user"])

@app.route("/login")
def login():
    auth_url = _build_auth_url()
    return redirect(auth_url)

@app.route(REDIRECT_PATH)
def authorized():
    code = request.args.get("code")
    if not code:
        return "Login failed", 400

    cca = _build_msal_app()
    result = cca.acquire_token_by_authorization_code(
        code,
        scopes=SCOPE,
        redirect_uri=f"http://localhost:5000{REDIRECT_PATH}"
    )
    if "access_token" in result:
        id_token_claims = result.get("id_token_claims")

        graph_data = get_user_graph_data(result["access_token"])
        id_token_claims["graph_data"] = graph_data

        session["user"] = id_token_claims

        cache = msal.SerializableTokenCache()
        cache.deserialize(session.get("token_cache", "{}"))
        session["token_cache"] = cache.serialize()
        return redirect(url_for("index"))

    return "Authentication failed", 400

if __name__ == "__main__":
    app.run(debug=True)
