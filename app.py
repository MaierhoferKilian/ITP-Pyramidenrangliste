from flask import Flask, render_template, url_for, session, redirect, request, jsonify
import msal, os, requests
from app_config import CLIENT_ID, CLIENT_SECRET, AUTHORITY, REDIRECT_PATH, SCOPE, SESSION_TYPE
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import enum
import hashlib
import random
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
    proposed_date = db.Column(db.Date)
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
    match_date = db.Column(db.Date)
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

def check_expired_challenges():
    """Check for challenges that have passed their deadline"""
    try:
        # Don't expire challenges during vacation periods? 
        # Requirement doesn't specify, but assuming consistent behavior with cleanup
        if is_vacation_period(datetime.utcnow().date()):
            return
            
        today = datetime.utcnow().date()
        
        # Find active challenges past deadline
        expired_challenges = Challenge.query.filter(
            Challenge.status.in_([StatusEnum.pending, StatusEnum.accepted]),
            Challenge.deadline_date < today
        ).all()
        
        for challenge in expired_challenges:
            print(f"Expiring challenge {challenge.challenge_id}")
            # Ensure match exists
            match = Match.query.filter_by(FK_challenge_id=challenge.challenge_id).first()
            if not match:
                match = Match(FK_challenge_id=challenge.challenge_id)
                db.session.add(match)
            
            # Set result 2:0 for challenger
            match.result = "2:0"
            match.match_date = challenge.deadline_date
            challenge.status = StatusEnum.completed
            
            # Update Rankings (Challenger wins)
            challenger = Player.query.get(challenge.FK_challenger_id)
            challenged = Player.query.get(challenge.FK_challenged_id)
            
            if challenger and challenged:
                challenger.total_wins += 1
                challenged.total_losses += 1
                
                # Logic: Challenger takes position of Challenged, everyone else shifts down
                if challenger.current_rank and challenged.current_rank and challenger.current_rank > challenged.current_rank:
                    old_challenger_rank = challenger.current_rank
                    target_rank = challenged.current_rank
                    
                    players_to_shift = Player.query.filter(
                        Player.current_rank >= target_rank,
                        Player.current_rank < old_challenger_rank
                    ).all()
                    
                    for p in players_to_shift:
                        p.current_rank += 1
                        
                    challenger.current_rank = target_rank
                    
                    if challenger.highest_rank is None or challenger.current_rank < challenger.highest_rank:
                        challenger.highest_rank = challenger.current_rank
                        
        if expired_challenges:
            db.session.commit()
            print(f"Processed {len(expired_challenges)} expired challenges")
            
    except Exception as e:
        print(f"Error processing expired challenges: {str(e)}")
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
    check_expired_challenges()
    
    current_player = Player.query.filter_by(uid=session["user"]["oid"]).first()
    
    # Check for active challenges
    has_active_challenge = False
    active_challenge_opponent_rank = None
    
    if current_player:
        active_statuses = [StatusEnum.pending, StatusEnum.accepted]
        active_challenge = Challenge.query.filter(
            ((Challenge.FK_challenger_id == current_player.uid) | (Challenge.FK_challenged_id == current_player.uid)) &
            Challenge.status.in_(active_statuses)
        ).first()
        
        if active_challenge:
            has_active_challenge = True
            opponent_id = active_challenge.FK_challenged_id if active_challenge.FK_challenger_id == current_player.uid else active_challenge.FK_challenger_id
            opponent = Player.query.filter_by(uid=opponent_id).first()
            if opponent:
                active_challenge_opponent_rank = opponent.current_rank

    total_players = Player.query.filter(Player.in_ranking == True).count()
    
    return render_template("index.html", 
                           current_player=current_player, 
                           total_players=total_players, 
                           has_active_challenge=has_active_challenge,
                           active_challenge_opponent_rank=active_challenge_opponent_rank)

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

# ===== FAKE LOGIN (kein Microsoft-Domain nötig) =====

def _generate_uid(email):
    """Erzeugt eine deterministische UID aus der Email (gleiche Email = gleicher User)"""
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()[:32]

def _extract_user_info(email):
    """Extrahiert realistischen Vor-/Nachnamen und generiert eine Klasse aus der Email.
    Erwartet Format: vorname.nachname@domain oder vorname@domain"""
    local_part = email.split('@')[0]  # z.B. 'max.mustermann'
    parts = local_part.split('.')
    
    firstname = parts[0].capitalize() if parts else 'Unbekannt'
    lastname = parts[1].capitalize() if len(parts) > 1 else ''
    
    # Realistische HTL-Klasse generieren (deterministisch basierend auf Email)
    random.seed(email.lower())  # Deterministisch: gleiche Email = gleiche Klasse
    year = random.choice(['1', '2', '3', '4', '5'])
    dept = random.choice(['AHIT', 'BHIT', 'AHEL', 'BHEL', 'AHME'])
    class_ = f"{year}{dept}"
    random.seed()  # Seed zurücksetzen
    
    return firstname, lastname, class_

@app.route("/login")
def login():
    # Zeige Fake-Login-Seite statt Microsoft-Redirect
    return render_template("login.html")

@app.route("/fake_login", methods=["POST"])
def fake_login():
    email = request.form.get("email", "").strip().lower()
    
    if not email or '@' not in email:
        return render_template("login.html", error="Bitte eine gültige Email-Adresse eingeben.")
    
    uid = _generate_uid(email)
    firstname, lastname, class_ = _extract_user_info(email)
    
    # Fake id_token_claims und graph_data erstellen (wie Microsoft es liefern würde)
    fake_claims = {
        "oid": uid,
        "preferred_username": email,
        "name": f"{firstname} {lastname}".strip(),
    }
    fake_graph_data = {
        "mail": email,
        "givenName": firstname,
        "surname": lastname,
        "jobTitle": class_,  # jobTitle wird als Klasse verwendet
    }
    
    # Spieler in DB anlegen/aktualisieren (nutzt die bestehende Funktion)
    create_or_update_player(fake_claims, fake_graph_data)
    
    # Session setzen (gleiche Struktur wie bei echtem Microsoft-Login)
    session["user"] = fake_claims
    
    return redirect(url_for("index"))

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
        today = datetime.now().date()
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
        
        # Parse match_date (proposed date)
        proposed_match_date = None
        if match_date:
            try:
                proposed_match_date = datetime.strptime(match_date, "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"error": "Ungültiges Datumsformat"}), 400
                
        # Calculate deadline (1 week from now)
        challenge_date = datetime.utcnow().date()
        deadline = challenge_date + timedelta(days=7)
        
        # Create new challenge
        new_challenge = Challenge(
            FK_challenger_id=current_player.uid,
            FK_challenged_id=challenged_uid,
            challenge_date=challenge_date,
            deadline_date=deadline,
            proposed_date=proposed_match_date,
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
            # Determine display date (match date or proposed date)
            display_date = match.match_date if match and match.match_date else challenge.proposed_date
            
            challenges_data.append({
                "challenge_id": challenge.challenge_id,
                "role": "challenger",
                "opponent_name": f"{challenged.firstname} {challenged.lastname}",
                "opponent_email": challenged.email,
                "opponent_rank": challenged.current_rank,
                "challenger_rank": current_player.current_rank,
                "status": challenge.status.value,
                "challenge_date": challenge.challenge_date.strftime("%d.%m.%Y") if challenge.challenge_date else "",
                "deadline_date": challenge.deadline_date.strftime("%d.%m.%Y") if challenge.deadline_date else "",
                "match_date": display_date.strftime("%d.%m.%Y") if display_date else "",
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
            # Determine display date (match date or proposed date)
            display_date = match.match_date if match and match.match_date else challenge.proposed_date
            
            challenges_data.append({
                "challenge_id": challenge.challenge_id,
                "role": "challenged",
                "opponent_name": f"{challenger.firstname} {challenger.lastname}",
                "opponent_email": challenger.email,
                "opponent_rank": challenger.current_rank,
                "challenged_rank": current_player.current_rank,
                "status": challenge.status.value,
                "challenge_date": challenge.challenge_date.strftime("%d.%m.%Y") if challenge.challenge_date else "",
                "deadline_date": challenge.deadline_date.strftime("%d.%m.%Y") if challenge.deadline_date else "",
                "match_date": display_date.strftime("%d.%m.%Y") if display_date else "",
                "challenger_date_confirmed": challenge.challenger_date_confirmed,
                "challenged_date_confirmed": challenge.challenged_date_confirmed,
                "challenger_wants_cancel": challenge.challenger_wants_cancel,
                "challenged_wants_cancel": challenge.challenged_wants_cancel,
                "challenger_result_confirmed": challenge.challenger_result_confirmed,
                "challenged_result_confirmed": challenge.challenged_result_confirmed,
                "match_result": match.result if match else None
            })
    
    return jsonify({"challenges": challenges_data})

@app.route("/withdraw_challenge", methods=["POST"])
def withdraw_challenge():
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
        
        # Only the challenger can withdraw
        if challenge.FK_challenger_id != current_player.uid:
            return jsonify({"error": "Only the challenger can withdraw"}), 403
        
        # Can only withdraw pending challenges
        if challenge.status != StatusEnum.pending:
            return jsonify({"error": "Kann nur ausstehende Herausforderungen zurückziehen"}), 400
        
        # Delete associated match if it exists
        associated_match = Match.query.filter_by(FK_challenge_id=challenge.challenge_id).first()
        if associated_match:
            db.session.delete(associated_match)
        
        # Delete associated notifications
        associated_notifications = Notification.query.filter_by(FK_challenge_id=challenge.challenge_id).all()
        for notif in associated_notifications:
            db.session.delete(notif)
        
        db.session.delete(challenge)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Herausforderung wurde zurückgezogen"
        })
        
    except Exception as e:
        print(f"Error withdrawing challenge: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Fehler beim Zurückziehen der Herausforderung"}), 500

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
        
        # Create match now that challenge is accepted
        # Try to find existing match first (just in case)
        match = Match.query.filter_by(FK_challenge_id=challenge.challenge_id).first()
        
        if not match:
            # Create new match with proposed date
            match = Match(
                FK_challenge_id=challenge.challenge_id,
                match_date=challenge.proposed_date,
                result=None
            )
            db.session.add(match)
        else:
             # Ensure match date is set from proposed if not already set
             if not match.match_date and challenge.proposed_date:
                 match.match_date = challenge.proposed_date
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Herausforderung akzeptiert",
            "match_id": match.match_id
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
            
            # Update proposed date on challenge
            challenge.proposed_date = new_date_obj
            
            # If a match exists (shouldn't for pending, but for safety), update it too
            match = Match.query.filter_by(FK_challenge_id=challenge.challenge_id).first()
            if match:
                match.match_date = new_date_obj
            
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
    
    # Direkt zur Login-Seite (kein Microsoft-Logout nötig)
    return redirect(url_for("login"))

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
    
    # Check if match date is reached
    if match.match_date and match.match_date > datetime.now().date():
         return jsonify({"error": "Das Match-Datum ist noch nicht erreicht."}), 400
    
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
                        
                        # Logic: Challenger takes position of Challenged, everyone else shifts down
                        if challenger.current_rank and challenged.current_rank and challenger.current_rank > challenged.current_rank:
                            old_challenger_rank = challenger.current_rank
                            target_rank = challenged.current_rank
                            
                            # Get all players who need to shift down (including the challenged player)
                            # Range is [target_rank, old_challenger_rank)
                            players_to_shift = Player.query.filter(
                                Player.current_rank >= target_rank,
                                Player.current_rank < old_challenger_rank
                            ).all()
                            
                            # Shift them down by 1
                            for p in players_to_shift:
                                p.current_rank += 1
                                
                            # Move challenger to the target rank
                            challenger.current_rank = target_rank
                            
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

@app.route("/get_match_history", methods=["GET"])
def get_match_history():
    try:
        # Get last 10 matches with results
        matches = db.session.query(Match, Challenge).join(Challenge, Match.FK_challenge_id == Challenge.challenge_id)\
            .filter(Match.result.isnot(None))\
            .order_by(Match.match_date.desc())\
            .limit(10).all()
            
        history = []
        for match, challenge in matches:
            challenger = Player.query.get(challenge.FK_challenger_id)
            challenged = Player.query.get(challenge.FK_challenged_id)
            
            if challenger and challenged:
                # Format match date
                date_str = match.match_date.strftime("%d.%m.%Y") if match.match_date else ""
                
                history.append({
                    "date": date_str,
                    "challenger": f"{challenger.firstname} {challenger.lastname}",
                    "challenged": f"{challenged.firstname} {challenged.lastname}",
                    "result": match.result
                })
                
        return jsonify({"history": history})
    except Exception as e:
        print(f"Error fetching match history: {e}")
        return jsonify({"error": "Failed to fetch match history"}), 500

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