import asyncio
import random
import httpx
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

STOCKY_URL = "https://stoky.onrender.com/api/health"


async def ping():
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            res = await client.get(STOCKY_URL)
            logging.info(f"Ping {res.status_code} - {res.json()}")
        except Exception as e:
            logging.warning(f"Ping failed: {e}")


async def main():
    logging.info("Keep-alive started")
    while True:
        await ping()
        sleep_seconds = random.randint(420, 840)  # 7 to 14 min
        logging.info(f"Next ping in {sleep_seconds // 60}m {sleep_seconds % 60}s")
        await asyncio.sleep(sleep_seconds)


if __name__ == "__main__":
    asyncio.run(main())
