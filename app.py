from flask import Flask, render_template, url_for, session, redirect, request, jsonify
import msal, os, requests
from app_config import CLIENT_ID, CLIENT_SECRET, AUTHORITY, REDIRECT_PATH, SCOPE, SESSION_TYPE
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import enum
from datetime import datetime

app = Flask(__name__)
app.config.from_object("app_config")
app.secret_key = os.urandom(24)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
db = SQLAlchemy(app)

# Initialize Flask-Migrate
migrate = Migrate(app, db)

# Enum für Challenge-Status
class StatusEnum(enum.Enum):
    pending = 'pending'
    accepted = 'accepted'
    rejected = 'rejected'
    completed = 'completed'
    expired = 'expired'

# Enum für Benachrichtigungstypen
class NotificationTypeEnum(enum.Enum):
    challenge = 'challenge'
    match_result = 'match_result'
    rank_change = 'rank_change'
    etc = 'etc'

# Spieler-Modell
class Player(db.Model):
    __tablename__ = 't_player'
    
    uid = db.Column(db.String(100), primary_key=True)  # eindeutig, unveränderlich, PK
    email = db.Column(db.String(100), nullable=False)
    firstname = db.Column(db.String(100))
    lastname = db.Column(db.String(100))
    class_ = db.Column('class', db.String(6))
    current_rank = db.Column(db.Integer)
    highest_rank = db.Column(db.Integer)
    total_wins = db.Column(db.Integer)
    total_losses = db.Column(db.Integer)
    active = db.Column(db.Boolean)
    
    # Beziehungen zu anderen Tabellen
    challenges_sent = db.relationship('Challenge', foreign_keys='Challenge.FK_challenger_id', backref='challenger', lazy=True)
    challenges_received = db.relationship('Challenge', foreign_keys='Challenge.FK_challenged_id', backref='challenged', lazy=True)
    notifications = db.relationship('Notification', backref='recipient', lazy=True)
    
    def __repr__(self):
        return f'<Player {self.firstname} {self.lastname}>'

# Herausforderungs-Modell
class Challenge(db.Model):
    __tablename__ = 't_challenge'
    
    challenge_id = db.Column(db.Integer, primary_key=True)
    FK_challenger_id = db.Column(db.String(100), db.ForeignKey('t_player.uid'), nullable=False)
    FK_challenged_id = db.Column(db.String(100), db.ForeignKey('t_player.uid'), nullable=False)
    challenge_date = db.Column(db.Date)
    response_date = db.Column(db.Date)
    deadline_date = db.Column(db.Date)
    status = db.Column(db.Enum(StatusEnum), default=StatusEnum.pending)
    
    # Beziehung zu Matches
    matches = db.relationship('Match', backref='challenge', lazy=True)
    
    # Beziehung zu Benachrichtigungen
    notifications = db.relationship('Notification', backref='challenge', lazy=True)
    
    def __repr__(self):
        return f'<Challenge {self.challenge_id} - Status: {self.status}>'

# Match-Modell
class Match(db.Model):
    __tablename__ = 't_match'
    
    match_id = db.Column(db.Integer, primary_key=True)
    result = db.Column(db.String(3))
    FK_challenge_id = db.Column(db.Integer, db.ForeignKey('t_challenge.challenge_id'), nullable=False)
    
    def __repr__(self):
        return f'<Match {self.match_id} - Result: {self.result}>'

# Benachrichtigungs-Modell
class Notification(db.Model):
    __tablename__ = 't_notification'
    
    notification_id = db.Column(db.Integer, primary_key=True)
    FK_challenge_id = db.Column(db.Integer, db.ForeignKey('t_challenge.challenge_id'))
    message = db.Column(db.Text)
    type = db.Column(db.Enum(NotificationTypeEnum))
    FK_recipient_id = db.Column(db.String(100), db.ForeignKey('t_player.uid'))
    
    def __repr__(self):
        return f'<Notification {self.notification_id} - Type: {self.type}>'

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

def create_or_update_player(id_token_claims, graph_data):
    try:
        # Eindeutige User-ID aus Microsoft (oid = Object ID)
        user_id = id_token_claims.get('oid') or id_token_claims.get('sub')
        
        if not user_id:
            return None
        
        # E-Mail-Adresse aus verschiedenen möglichen Feldern
        email = (graph_data.get('mail'))
        
        # Vorname und Nachname
        firstname = graph_data.get('givenName', '')
        lastname = graph_data.get('surname', '')
        class_ = graph_data.get('jobTitle', '')
        
        # Prüfe ob Player bereits existiert
        existing_player = Player.query.filter_by(uid=user_id).first()
        
        if existing_player:
            # Aktualisiere bestehenden Player
            existing_player.email = email or existing_player.email
            existing_player.firstname = firstname or existing_player.firstname
            existing_player.lastname = lastname or existing_player.lastname
            existing_player.active = True
            existing_player.class_ = class_ or existing_player.class_
        else:
            # Erstelle neuen Player
            # Bestimme den nächsten Rang (letzter Platz + 1)
            last_rank = db.session.query(db.func.max(Player.current_rank)).scalar() or 0
            new_rank = last_rank + 1
            
            new_player = Player(
                uid=user_id,
                email=email,
                firstname=firstname,
                lastname=lastname,
                class_=class_,
                current_rank=new_rank,
                highest_rank=new_rank,
                total_wins=0,
                total_losses=0,
                active=True
            )
            
            db.session.add(new_player)
        
        db.session.commit()
        return True
        
    except Exception as e:
        print(f"Fehler beim Erstellen/Aktualisieren des Players: {str(e)}")
        db.session.rollback()
        return False

# Routes
@app.route("/")
def index():
    if not session.get("user"):
        return redirect(url_for("login"))
    
    current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
    total_players = Player.query.filter_by(active=True).count()
    
    return render_template("index.html", current_player=current_player, total_players=total_players)

@app.route("/selected_player", methods=["POST"])
def selected_player():
    data = request.get_json()
    position = data.get("position")

    selected_player = Player.query.filter_by(current_rank=position).first()
    if selected_player:
        total_games = selected_player.total_wins + selected_player.total_losses
        win_rate = round((selected_player.total_wins / total_games * 100), 2) if total_games > 0 else 0
        
        return jsonify({
            "uid": selected_player.uid,
            "firstname": selected_player.firstname,
            "lastname": selected_player.lastname,
            "class": selected_player.class_,
            "email": selected_player.email,
            "current_rank": selected_player.current_rank,
            "highest_rank": selected_player.highest_rank,
            "total_wins": selected_player.total_wins,
            "total_losses": selected_player.total_losses,
            "win_rate": win_rate
        })
    return jsonify({"error": "Player not found"}), 404

@app.route("/set_player_inactive", methods=["POST"])
def set_player_inactive():
    if not session.get("user"):
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    uid = data.get("uid")
    
    if not uid:
        return jsonify({"error": "Player UID required"}), 400
    
    player = Player.query.filter_by(uid=uid).first()
    if not player:
        return jsonify({"error": "Player not found"}), 404
    
    try:
        player.active = False
        db.session.commit()
        return jsonify({"success": True, "message": "Player set to inactive"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update player: {str(e)}"}), 500

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

        create_or_update_player(id_token_claims, graph_data)

        session["user"] = id_token_claims

        cache = msal.SerializableTokenCache()
        cache.deserialize(session.get("token_cache", "{}"))
        session["token_cache"] = cache.serialize()
        return redirect(url_for("index"))

    return "Authentication failed", 400

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)