import redis

# TODO: mover configs para app/core/config.py
redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
