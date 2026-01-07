from flask import Flask, render_template, url_for, session, redirect, request, jsonify
import msal, os, requests
from app_config import CLIENT_ID, CLIENT_SECRET, AUTHORITY, REDIRECT_PATH, SCOPE, SESSION_TYPE
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import enum
from datetime import datetime, timedelta

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

# Enum für Benachrichtigungs-Typen
class NotificationTypeEnum(enum.Enum):
    challenge = 'challenge'
    match_result = 'match_result'
    rank_change = 'rank_change'
    etc = 'etc'

# Spieler-Modell
class Player(db.Model):
    __tablename__ = 't_player'
    
    uid = db.Column(db.String(100), primary_key=True)
    email = db.Column(db.String(100), nullable=False)
    firstname = db.Column(db.String(100))
    lastname = db.Column(db.String(100))
    class_ = db.Column('class', db.String(6))
    current_rank = db.Column(db.Integer, nullable=True)
    highest_rank = db.Column(db.Integer, nullable=True)
    total_wins = db.Column(db.Integer, default=0)
    total_losses = db.Column(db.Integer, default=0)
    last_active = db.Column(db.DateTime)
    blocked_until = db.Column(db.DateTime)
    in_ranking = db.Column(db.Boolean, default=False)
    
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
    challenger_date_confirmed = db.Column(db.Boolean, default=True)
    challenged_date_confirmed = db.Column(db.Boolean, default=False)
    challenger_wants_cancel = db.Column(db.Boolean, default=False)
    challenged_wants_cancel = db.Column(db.Boolean, default=False)
    challenger_result_confirmed = db.Column(db.Boolean, default=False)
    challenged_result_confirmed = db.Column(db.Boolean, default=False)
    
    # Beziehung zu Matches
    matches = db.relationship('Match', backref='challenge', lazy=True)
    
    # Beziehung zu Benachrichtigungen
    notifications = db.relationship('Notification', backref='challenge', lazy=True)
    
    def __repr__(self):
        return f'<Challenge {self.challenge_id} - Status: {self.status}'

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
        
        # Only update last_active if not in vacation period
        current_date = datetime.utcnow()
        should_update_last_active = not is_vacation_period(current_date.date())
        
        if existing_player:
            # Aktualisiere bestehenden Player
            existing_player.email = email or existing_player.email
            existing_player.firstname = firstname or existing_player.firstname
            existing_player.lastname = lastname or existing_player.lastname
            if should_update_last_active:
                existing_player.last_active = current_date
            existing_player.class_ = class_ or existing_player.class_
        else:
            # Erstelle neuen Player ohne Rang
            new_player = Player(
                uid=user_id,
                email=email,
                firstname=firstname,
                lastname=lastname,
                class_=class_,
                current_rank=None,
                highest_rank=None,
                total_wins=0,
                total_losses=0,
                last_active=current_date if should_update_last_active else None,
                blocked_until=None,
                in_ranking=False
            )
            
            db.session.add(new_player)
        
        db.session.commit()
        return True
        
    except Exception as e:
        print(f"Fehler beim Erstellen/Aktualisieren des Players: {str(e)}")
        db.session.rollback()
        return False

def cleanup_inactive_players():
    """Remove players inactive for more than 3 weeks and adjust rankings"""
    try:
        # Don't run cleanup during vacation periods
        if is_vacation_period(datetime.utcnow().date()):
            print("Cleanup skipped: Currently in vacation period")
            return
        
        three_weeks_ago = datetime.utcnow() - timedelta(weeks=3)
        
        # Find all players inactive for more than 3 weeks who are in the ranking
        # We need to calculate effective inactivity, excluding vacation periods
        inactive_players = []
        all_active_players = Player.query.filter(Player.in_ranking == True).all()
        
        for player in all_active_players:
            if player.last_active:
                # Calculate days inactive, excluding vacation days
                days_inactive = 0
                check_date = player.last_active.date()
                today = datetime.utcnow().date()
                
                while check_date < today:
                    check_date += timedelta(days=1)
                    if not is_vacation_period(check_date):
                        days_inactive += 1
                
                # 3 weeks = 21 days
                if days_inactive > 21:
                    inactive_players.append(player)
        
        if not inactive_players:
            return
        
        # Sort by rank for proper adjustment
        inactive_players.sort(key=lambda p: p.current_rank)
        
        # Delete inactive players and collect their ranks
        deleted_ranks = []
        for player in inactive_players:
            deleted_ranks.append(player.current_rank)
            db.session.delete(player)
        
        db.session.flush()
        
        # Adjust rankings for remaining players
        deleted_ranks.sort()
        for deleted_rank in deleted_ranks:
            players_to_update = Player.query.filter(
                Player.current_rank > deleted_rank
            ).all()
            
            for player in players_to_update:
                player.current_rank -= 1
        
        db.session.commit()
        print(f"Cleaned up {len(inactive_players)} inactive players")
        
    except Exception as e:
        print(f"Error cleaning up inactive players: {str(e)}")
        db.session.rollback()

def is_vacation_period(date):
    """Check if a date falls within vacation periods (July, August, Dec 24 - Jan 6)"""
    month = date.month
    day = date.day
    
    # Summer vacation: July and August
    if month in [7, 8]:
        return True
    
    # Winter holidays: December 24 to January 6
    if (month == 12 and day >= 24) or (month == 1 and day <= 6):
        return True
    
    return False

def get_next_available_date(start_date):
    """Get the next available date that's not in a vacation period"""
    current_date = start_date
    max_attempts = 365  # Prevent infinite loop
    attempts = 0
    
    while is_vacation_period(current_date) and attempts < max_attempts:
        current_date += timedelta(days=1)
        attempts += 1
    
    return current_date

# Routes
@app.route("/")
def index():
    if not session.get("user"):
        return redirect(url_for("login"))
    
    # Clean up inactive players before displaying rankings
    cleanup_inactive_players()
    
    current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
    total_players = Player.query.filter(Player.in_ranking == True).count()
    
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

@app.route("/login")
def login():
    auth_url = _build_auth_url()
    return redirect(auth_url)

@app.route("/join_ranking", methods=["POST"])
def join_ranking():
    if not session.get("user"):
        return jsonify({"error": "Not logged in"}), 401
    
    current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
    if not current_player:
        return jsonify({"error": "Player not found"}), 404
    
    if current_player.in_ranking:
        return jsonify({"error": "Already in ranking"}), 400
    
    # Check if player is blocked
    if current_player.blocked_until and current_player.blocked_until > datetime.utcnow():
        blocked_until_str = current_player.blocked_until.strftime("%d.%m.%Y %H:%M")
        return jsonify({"error": f"You are blocked until {blocked_until_str}"}), 403
    
    # Check if currently in vacation period
    today = datetime.utcnow().date()
    if is_vacation_period(today):
        next_available = get_next_available_date(today)
        return jsonify({
            "error": f"Cannot join during vacation period. Please try again after {next_available.strftime('%d.%m.%Y')}"
        }), 403
    
    # Add player to ranking at the last position
    last_rank = db.session.query(db.func.max(Player.current_rank)).filter(Player.in_ranking == True).scalar() or 0
    new_rank = last_rank + 1
    
    current_player.current_rank = new_rank
    current_player.highest_rank = new_rank
    current_player.in_ranking = True
    current_player.blocked_until = None
    
    db.session.commit()
    return jsonify({"success": True, "message": "Successfully joined the ranking", "rank": new_rank})

@app.route("/leave_ranking", methods=["POST"])
def leave_ranking():
    if not session.get("user"):
        return jsonify({"error": "Not logged in"}), 401
    
    current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
    if current_player:
        if not current_player.in_ranking:
            return jsonify({"error": "Not in ranking"}), 400
        
        # Get the rank before removing
        leaving_rank = current_player.current_rank
        
        # Remove from ranking
        current_player.current_rank = None
        current_player.in_ranking = False
        # Block user for 1 week
        current_player.blocked_until = datetime.utcnow() + timedelta(weeks=1)
        
        db.session.flush()
        
        # Move all players below up by one
        players_to_update = Player.query.filter(
            Player.current_rank > leaving_rank,
            Player.in_ranking == True
        ).all()
        
        for player in players_to_update:
            player.current_rank -= 1
        
        db.session.commit()
        return jsonify({"success": True, "message": "You have left the ranking and are blocked for 1 week"})
    
    return jsonify({"error": "Player not found"}), 404

@app.route("/create_challenge", methods=["POST"])
def create_challenge():
    if not session.get("user"):
        return jsonify({"error": "Not logged in"}), 401
    
    try:
        data = request.get_json()
        challenged_uid = data.get("challenged_uid")
        match_date = data.get("match_date")
        
        if not challenged_uid:
            return jsonify({"error": "No challenged player specified"}), 400
        
        current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
        challenged_player = Player.query.filter_by(uid=challenged_uid).first()
        
        if not current_player or not challenged_player:
            return jsonify({"error": "Player not found"}), 404
        
        # Check if player is trying to challenge themselves
        if current_player.uid == challenged_uid:
            return jsonify({"error": "Sie können sich nicht selbst herausfordern"}), 400
        
        # Check if currently in vacation period
        today = datetime.utcnow().date()
        if is_vacation_period(today):
            next_available = get_next_available_date(today)
            return jsonify({
                "error": f"Herausforderungen können während der Ferienzeit nicht erstellt werden. Bitte versuchen Sie es nach dem {next_available.strftime('%d.%m.%Y')} erneut."
            }), 403
        
        # Check if challenger already has an active challenge
        existing_as_challenger = Challenge.query.filter(
            Challenge.FK_challenger_id == current_player.uid,
            Challenge.status.in_([StatusEnum.pending, StatusEnum.accepted])
        ).first()
        
        existing_as_challenged = Challenge.query.filter(
            Challenge.FK_challenged_id == current_player.uid,
            Challenge.status.in_([StatusEnum.pending, StatusEnum.accepted])
        ).first()
        
        if existing_as_challenger or existing_as_challenged:
            return jsonify({"error": "Sie haben bereits eine aktive Herausforderung"}), 400
        
        # Check if challenged player already has an active challenge
        challenged_has_challenge = Challenge.query.filter(
            db.or_(
                db.and_(
                    Challenge.FK_challenger_id == challenged_uid,
                    Challenge.status.in_([StatusEnum.pending, StatusEnum.accepted])
                ),
                db.and_(
                    Challenge.FK_challenged_id == challenged_uid,
                    Challenge.status.in_([StatusEnum.pending, StatusEnum.accepted])
                )
            )
        ).first()
        
        if challenged_has_challenge:
            return jsonify({"error": "Der Herausgeforderte hat bereits eine aktive Herausforderung"}), 400
        
        # Check if this would be a consecutive challenge from the same player
        # We check the user's OVERALL last challenge, not just against this specific opponent.
        last_completed_challenge = Challenge.query.filter(
            db.or_(
                Challenge.FK_challenger_id == current_player.uid,
                Challenge.FK_challenged_id == current_player.uid
            ),
            Challenge.status == StatusEnum.completed
        ).order_by(Challenge.challenge_id.desc()).first()
        
        if last_completed_challenge and last_completed_challenge.FK_challenger_id == current_player.uid and last_completed_challenge.FK_challenged_id == challenged_uid:
            return jsonify({"error": "Sie können denselben Spieler nicht zweimal hintereinander herausfordern"}), 400
        
        # Parse match_date
        deadline = None
        if match_date:
            try:
                match_date_obj = datetime.strptime(match_date, "%Y-%m-%d").date()
                deadline = match_date_obj
            except ValueError:
                return jsonify({"error": "Ungültiges Datumsformat"}), 400
        
        # Create new challenge
        new_challenge = Challenge(
            FK_challenger_id=current_player.uid,
            FK_challenged_id=challenged_uid,
            challenge_date=datetime.utcnow().date(),
            deadline_date=deadline,
            status=StatusEnum.pending
        )
        
        db.session.add(new_challenge)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Herausforderung erfolgreich erstellt",
            "challenge_id": new_challenge.challenge_id
        })
        
    except Exception as e:
        print(f"Error creating challenge: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Fehler beim Erstellen der Herausforderung"}), 500

@app.route("/get_my_challenges", methods=["GET"])
def get_my_challenges():
    if not session.get("user"):
        return jsonify({"error": "Not logged in"}), 401
    
    current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
    
    if not current_player:
        return jsonify({"error": "Player not found"}), 404
    
    # Get all active challenges where current user is involved
    challenges_as_challenger = Challenge.query.filter(
        Challenge.FK_challenger_id == current_player.uid,
        Challenge.status.in_([StatusEnum.pending, StatusEnum.accepted])
    ).all()
    
    challenges_as_challenged = Challenge.query.filter(
        Challenge.FK_challenged_id == current_player.uid,
        Challenge.status.in_([StatusEnum.pending, StatusEnum.accepted])
    ).all()
    
    challenges_data = []
    
    for challenge in challenges_as_challenger:
        challenged = Player.query.filter_by(uid=challenge.FK_challenged_id).first()
        match = Match.query.filter_by(FK_challenge_id=challenge.challenge_id).first()
        if challenged:
            challenges_data.append({
                "challenge_id": challenge.challenge_id,
                "role": "challenger",
                "opponent_name": f"{challenged.firstname} {challenged.lastname}",
                "opponent_rank": challenged.current_rank,
                "challenger_rank": current_player.current_rank,
                "status": challenge.status.value,
                "challenge_date": challenge.challenge_date.strftime("%d.%m.%Y") if challenge.challenge_date else "",
                "deadline_date": challenge.deadline_date.strftime("%d.%m.%Y") if challenge.deadline_date else "",
                "challenger_date_confirmed": challenge.challenger_date_confirmed,
                "challenged_date_confirmed": challenge.challenged_date_confirmed,
                "challenger_wants_cancel": challenge.challenger_wants_cancel,
                "challenged_wants_cancel": challenge.challenged_wants_cancel,
                "challenger_result_confirmed": challenge.challenger_result_confirmed,
                "challenged_result_confirmed": challenge.challenged_result_confirmed,
                "match_result": match.result if match else None
            })
    
    for challenge in challenges_as_challenged:
        challenger = Player.query.filter_by(uid=challenge.FK_challenger_id).first()
        match = Match.query.filter_by(FK_challenge_id=challenge.challenge_id).first()
        if challenger:
            challenges_data.append({
                "challenge_id": challenge.challenge_id,
                "role": "challenged",
                "opponent_name": f"{challenger.firstname} {challenger.lastname}",
                "opponent_rank": challenger.current_rank,
                "challenged_rank": current_player.current_rank,
                "status": challenge.status.value,
                "challenge_date": challenge.challenge_date.strftime("%d.%m.%Y") if challenge.challenge_date else "",
                "deadline_date": challenge.deadline_date.strftime("%d.%m.%Y") if challenge.deadline_date else "",
                "challenger_date_confirmed": challenge.challenger_date_confirmed,
                "challenged_date_confirmed": challenge.challenged_date_confirmed,
                "challenger_wants_cancel": challenge.challenger_wants_cancel,
                "challenged_wants_cancel": challenge.challenged_wants_cancel,
                "challenger_result_confirmed": challenge.challenger_result_confirmed,
                "challenged_result_confirmed": challenge.challenged_result_confirmed,
                "match_result": match.result if match else None
            })
    
    return jsonify({"challenges": challenges_data})

@app.route("/accept_challenge", methods=["POST"])
def accept_challenge():
    if not session.get("user"):
        return jsonify({"error": "Not logged in"}), 401
    
    try:
        data = request.get_json()
        challenge_id = data.get("challenge_id")
        
        if not challenge_id:
            return jsonify({"error": "No challenge ID specified"}), 400
        
        challenge = Challenge.query.filter_by(challenge_id=challenge_id).first()
        
        if not challenge:
            return jsonify({"error": "Challenge not found"}), 404
        
        current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
        
        # Verify the current user is the challenged player
        if challenge.FK_challenged_id != current_player.uid:
            return jsonify({"error": "You are not the challenged player"}), 403
        
        # Update challenge status
        challenge.status = StatusEnum.accepted
        challenge.response_date = datetime.utcnow().date()
        
        # Create match with null result
        new_match = Match(
            FK_challenge_id=challenge.challenge_id,
            result=None
        )
        
        db.session.add(new_match)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Herausforderung akzeptiert und Match erstellt",
            "match_id": new_match.match_id
        })
        
    except Exception as e:
        print(f"Error accepting challenge: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Fehler beim Akzeptieren der Herausforderung"}), 500

@app.route("/update_challenge_date", methods=["POST"])
def update_challenge_date():
    if not session.get("user"):
        return jsonify({"error": "Not logged in"}), 401
    
    try:
        data = request.get_json()
        challenge_id = data.get("challenge_id")
        new_date = data.get("new_date")
        
        if not challenge_id or not new_date:
            return jsonify({"error": "Missing challenge ID or date"}), 400
        
        challenge = Challenge.query.filter_by(challenge_id=challenge_id).first()
        
        if not challenge:
            return jsonify({"error": "Challenge not found"}), 404
        
        current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
        
        # Verify the current user is involved in this challenge
        if challenge.FK_challenger_id != current_player.uid and challenge.FK_challenged_id != current_player.uid:
            return jsonify({"error": "You are not part of this challenge"}), 403
        
        # Only allow date updates for pending challenges
        if challenge.status != StatusEnum.pending:
            return jsonify({"error": "Can only update date for pending challenges"}), 400
        
        # Parse and update the date
        try:
            new_date_obj = datetime.strptime(new_date, "%Y-%m-%d").date()
            challenge.deadline_date = new_date_obj
            
            # Reset confirmation status - the person who changed it is confirmed, the other needs to confirm
            if challenge.FK_challenger_id == current_player.uid:
                challenge.challenger_date_confirmed = True
                challenge.challenged_date_confirmed = False
            else:
                challenge.challenger_date_confirmed = False
                challenge.challenged_date_confirmed = True
            
            db.session.commit()
            
            return jsonify({
                "success": True,
                "message": "Datum erfolgreich aktualisiert. Der andere Spieler muss das Datum bestätigen."
            })
        except ValueError:
            return jsonify({"error": "Ungültiges Datumsformat"}), 400
        
    except Exception as e:
        print(f"Error updating challenge date: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Fehler beim Aktualisieren des Datums"}), 500

@app.route("/confirm_challenge_date", methods=["POST"])
def confirm_challenge_date():
    if not session.get("user"):
        return jsonify({"error": "Not logged in"}), 401
    
    try:
        data = request.get_json()
        challenge_id = data.get("challenge_id")
        
        if not challenge_id:
            return jsonify({"error": "Missing challenge ID"}), 400
        
        challenge = Challenge.query.filter_by(challenge_id=challenge_id).first()
        
        if not challenge:
            return jsonify({"error": "Challenge not found"}), 404
        
        current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
        
        # Verify the current user is involved in this challenge
        if challenge.FK_challenger_id != current_player.uid and challenge.FK_challenged_id != current_player.uid:
            return jsonify({"error": "You are not part of this challenge"}), 403
        
        # Only allow confirmation for pending challenges
        if challenge.status != StatusEnum.pending:
            return jsonify({"error": "Can only confirm date for pending challenges"}), 400
        
        # Update confirmation status
        if challenge.FK_challenger_id == current_player.uid:
            challenge.challenger_date_confirmed = True
        else:
            challenge.challenged_date_confirmed = True
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Datum bestätigt"
        })
        
    except Exception as e:
        print(f"Error confirming challenge date: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Fehler beim Bestätigen des Datums"}), 500

@app.route("/toggle_cancel_challenge", methods=["POST"])
def toggle_cancel_challenge():
    if not session.get("user"):
        return jsonify({"error": "Not logged in"}), 401
    
    try:
        data = request.get_json()
        challenge_id = data.get("challenge_id")
        wants_cancel = data.get("wants_cancel")
        
        if not challenge_id or wants_cancel is None:
            return jsonify({"error": "Missing challenge ID or cancel status"}), 400
        
        challenge = Challenge.query.filter_by(challenge_id=challenge_id).first()
        
        if not challenge:
            return jsonify({"error": "Challenge not found"}), 404
        
        current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
        
        # Verify the current user is involved in this challenge
        if challenge.FK_challenger_id != current_player.uid and challenge.FK_challenged_id != current_player.uid:
            return jsonify({"error": "You are not part of this challenge"}), 403
        
        # Allow cancellation for pending and accepted challenges
        if challenge.status not in [StatusEnum.pending, StatusEnum.accepted]:
            return jsonify({"error": "Can only cancel pending or accepted challenges"}), 400
        
        # Update cancel status
        if challenge.FK_challenger_id == current_player.uid:
            challenge.challenger_wants_cancel = wants_cancel
        else:
            challenge.challenged_wants_cancel = wants_cancel
        
        # If both want to cancel, delete the challenge and associated match
        if challenge.challenger_wants_cancel and challenge.challenged_wants_cancel:
            # Delete associated match if it exists
            associated_match = Match.query.filter_by(FK_challenge_id=challenge.challenge_id).first()
            if associated_match:
                db.session.delete(associated_match)
            
            # Delete the challenge
            db.session.delete(challenge)
            db.session.commit()
            return jsonify({
                "success": True,
                "message": "Herausforderung und Match wurden abgebrochen",
                "cancelled": True
            })
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Abbruch-Status aktualisiert",
            "cancelled": False
        })
        
    except Exception as e:
        print(f"Error toggling cancel challenge: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Fehler beim Aktualisieren des Abbruch-Status"}), 500

@app.route("/logout")
def logout():
    # Clear the session
    session.clear()
    
    # Redirect to Microsoft logout endpoint
    logout_url = f"{AUTHORITY}/oauth2/v2.0/logout?post_logout_redirect_uri=http://localhost:5000/login"
    return redirect(logout_url)

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

@app.route("/submit_match_result", methods=["POST"])
def submit_match_result():
    if not session.get("user"):
        return jsonify({"error": "Not logged in"}), 401
    
    data = request.get_json()
    challenge_id = data.get("challenge_id")
    result_str = data.get("result")
    
    if not challenge_id or not result_str:
        return jsonify({"error": "Missing data"}), 400
        
    current_uid = session["user"]["oid"]
    
    challenge = Challenge.query.get(challenge_id)
    if not challenge:
        return jsonify({"error": "Challenge not found"}), 404
        
    if challenge.FK_challenger_id != current_uid and challenge.FK_challenged_id != current_uid:
        return jsonify({"error": "Not authorized"}), 403
        
    # Find the match associated with this challenge
    match = Match.query.filter_by(FK_challenge_id=challenge.challenge_id).first()
    if not match:
        # Create match if it doesn't exist
        match = Match(FK_challenge_id=challenge.challenge_id)
        db.session.add(match)
    
    # Check if result is changing
    is_new_result = match.result != result_str
    
    match.result = result_str
    
    # Update confirmation status
    if challenge.FK_challenger_id == current_uid:
        challenge.challenger_result_confirmed = True
        if is_new_result:
            challenge.challenged_result_confirmed = False
    else:
        challenge.challenged_result_confirmed = True
        if is_new_result:
            challenge.challenger_result_confirmed = False

    # Check if both confirmed
    if challenge.challenger_result_confirmed and challenge.challenged_result_confirmed:
        # Update stats and ranks
        try:
            # Format is "challenger_sets:challenged_sets"
            sets = result_str.split(':')
            if len(sets) == 2:
                challenger_score = int(sets[0])
                challenged_score = int(sets[1])
                
                challenger = Player.query.get(challenge.FK_challenger_id)
                challenged = Player.query.get(challenge.FK_challenged_id)
                
                if challenger and challenged:
                    # Update wins/losses
                    if challenger_score > challenged_score:
                        challenger.total_wins += 1
                        challenged.total_losses += 1
                        
                        # Swap ranks if challenger won against someone with better rank (lower number)
                        if challenger.current_rank and challenged.current_rank and challenger.current_rank > challenged.current_rank:
                            temp_rank = challenger.current_rank
                            challenger.current_rank = challenged.current_rank
                            challenged.current_rank = temp_rank
                            
                            # Update highest rank
                            if challenger.highest_rank is None or challenger.current_rank < challenger.highest_rank:
                                challenger.highest_rank = challenger.current_rank
                    else:
                        challenged.total_wins += 1
                        challenger.total_losses += 1
                        # No rank change if challenged wins (defended position)
                        
        except Exception as e:
            print(f"Error updating stats: {e}")
            # Continue to at least save the match result
        
        # Mark challenge as completed
        challenge.status = StatusEnum.completed
    
    try:
        db.session.commit()
        return jsonify({
            "success": True, 
            "confirmed": challenge.challenger_result_confirmed and challenge.challenged_result_confirmed
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
        # Update existing players to have in_ranking = True if they have a rank
        try:
            players_with_rank = Player.query.filter(
                Player.current_rank.isnot(None)
            ).all()
            
            for player in players_with_rank:
                player.in_ranking = True
            
            db.session.commit()
            print("Database initialized successfully")
        except Exception as e:
            print(f"Note: {str(e)}")
            db.session.rollback()
            
    app.run(debug=True)