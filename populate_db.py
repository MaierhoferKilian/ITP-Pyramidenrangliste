from app import app, db, Player
from datetime import datetime
import uuid

def populate_users(count=15):
    with app.app_context():
        # Get current max rank
        max_rank = db.session.query(db.func.max(Player.current_rank)).scalar() or 0
        print(f"Current max rank: {max_rank}")
        
        new_players = []
        for i in range(1, count + 1):
            rank = max_rank + i
            uid = str(uuid.uuid4())
            player = Player(
                uid=uid,
                email=f"test.user{rank}@example.com",
                firstname=f"Test",
                lastname=f"User{rank}",
                class_="5AHIT",
                current_rank=rank,
                highest_rank=rank,
                total_wins=0,
                total_losses=0,
                last_active=datetime.now(),
                in_ranking=True
            )
            new_players.append(player)
            print(f"Adding Test User{rank} at rank {rank}")
            
        db.session.add_all(new_players)
        db.session.commit()
        print(f"Successfully added {count} test users.")

if __name__ == "__main__":
    populate_users(30)
