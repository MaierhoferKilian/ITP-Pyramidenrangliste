from app import app, db, Player, Challenge, Match, StatusEnum
from datetime import datetime, timedelta
import uuid
import random

def populate_users():
    with app.app_context():
        print("Cleaning up old test data...")
        # Optional: Clean up existing test users (careful not to delete real ones if any)
        # Using a specific domain for test users to safely delete them
        db.session.query(Match).filter(Match.FK_challenge_id.in_(
            db.session.query(Challenge.challenge_id).join(Player, Challenge.FK_challenger_id == Player.uid).filter(Player.email.like('%@test-school.at'))
        )).delete(synchronize_session=False)
        
        db.session.query(Challenge).filter(Challenge.FK_challenger_id.in_(
            db.session.query(Player.uid).filter(Player.email.like('%@test-school.at'))
        )).delete(synchronize_session=False)

        db.session.query(Player).filter(Player.email.like('%@test-school.at')).delete(synchronize_session=False)
        db.session.commit()

        first_names = ["Lukas", "Julia", "Maximilian", "Sophie", "Paul", "Leonie", "Jonas", "Lena", "Elias", "Anna", 
                       "Felix", "Emily", "David", "Marie", "Tobias", "Sarah", "Florian", "Laura", "Simon", "Johanna", 
                       "Philipp", "Katharina", "Alexander", "Viktoria", "Fabian", "Lisa", "Julian", "Isabella", "Moritz", "Hannah",
                       "Jakob", "Mia", "Samuel", "Valentina", "Sebastian", "Emma", "Niklas", "Lea", "Emil", "Clara"]
        
        last_names = ["Müller", "Bauer", "Huber", "Gruber", "Pichler", "Steiner", "Moser", "Mayer", "Hofer", "Leitner", 
                      "Wagner", "Fuchs", "Berger", "Winkler", "Weber", "Schwarz", "Eder", "Reiter", "Schmid", "Maier",
                      "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Schäfer", "Koch"]
        
        classes = ["1AHIT", "2AHIT", "3AHIT", "4AHIT", "5AHIT", "1BHIT", "2BHIT", "3BHIT", "4BHIT", "5BHIT"]

        players = []
        
        # Determine start rank (after existing real users)
        current_max_rank = db.session.query(db.func.max(Player.current_rank)).filter(Player.email.notlike('%@test-school.at')).scalar() or 0
        start_rank = current_max_rank + 1

        print(f"Creating 40 new players starting at rank {start_rank}...")

        # Create 40 Players
        for i in range(40):
            fn = random.choice(first_names)
            ln = random.choice(last_names)
            # Ensure uniqueness
            if any(p.firstname == fn and p.lastname == ln for p in players):
                ln = random.choice(last_names)

            rank = start_rank + i
            player = Player(
                uid=str(uuid.uuid4()),
                email=f"{fn.lower()}.{ln.lower()}@test-school.at",
                firstname=fn,
                lastname=ln,
                class_=random.choice(classes),
                current_rank=rank,
                highest_rank=rank,
                total_wins=0,
                total_losses=0,
                last_active=datetime.now() - timedelta(days=random.randint(0, 10)),
                in_ranking=True
            )
            players.append(player)
            db.session.add(player)
        
        db.session.flush()
        
        print("Generating match history...")
        
        results = ["3:0", "3:1", "3:2", "0:3", "1:3", "2:3", "3:0", "0:3"]
        
        # 1. Past completed matches (Stats)
        for _ in range(60): # 60 historic matches
            p1, p2 = random.sample(players, 2)
            
            match_date = datetime.now() - timedelta(days=random.randint(1, 60))
            
            c = Challenge(
                FK_challenger_id=p1.uid,
                FK_challenged_id=p2.uid,
                challenge_date=match_date - timedelta(days=2),
                deadline_date=match_date + timedelta(days=5),
                proposed_date=match_date.date(),
                status=StatusEnum.completed,
                challenger_date_confirmed=True,
                challenged_date_confirmed=True,
                challenger_result_confirmed=True,
                challenged_result_confirmed=True
            )
            db.session.add(c)
            db.session.flush()
            
            res = random.choice(results)
            m = Match(
                FK_challenge_id=c.challenge_id,
                match_date=match_date.date(),
                result=res
            )
            db.session.add(m)
            
            # Update stats
            p1_score = int(res.split(':')[0])
            p2_score = int(res.split(':')[1])
            
            if p1_score > p2_score:
                p1.total_wins += 1
                p2.total_losses += 1
            else:
                p2.total_wins += 1
                p1.total_losses += 1

        # 2. Add some active/pending challenges
        print("Generating active challenges...")
        for _ in range(5):
            p1, p2 = random.sample(players, 2)
            c_pending = Challenge(
                FK_challenger_id=p1.uid,
                FK_challenged_id=p2.uid,
                challenge_date=datetime.now(),
                deadline_date=datetime.now() + timedelta(days=7),
                status=StatusEnum.pending
            )
            db.session.add(c_pending)

        # 3. Add some accepted challenges with scheduled matches
        for _ in range(5):
            p1, p2 = random.sample(players, 2)
            future_date = datetime.now() + timedelta(days=random.randint(1, 5))
            
            c_accepted = Challenge(
                FK_challenger_id=p1.uid,
                FK_challenged_id=p2.uid,
                challenge_date=datetime.now() - timedelta(days=1),
                deadline_date=datetime.now() + timedelta(days=6),
                proposed_date=future_date.date(),
                status=StatusEnum.accepted,
                challenger_date_confirmed=True,
                challenged_date_confirmed=True
            )
            db.session.add(c_accepted)
            db.session.flush()
            
            m_scheduled = Match(
                FK_challenge_id=c_accepted.challenge_id,
                match_date=future_date.date(),
                result=None
            )
            db.session.add(m_scheduled)

        db.session.commit()
        print("Population complete.")

if __name__ == "__main__":
    populate_users()
