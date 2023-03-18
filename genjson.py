import sqlite3
import ujson

systems = []
con = sqlite3.connect("/home/rkb/sqlite-latest.sqlite")
cur = con.cursor()
for row in cur.execute(
    "SELECT solarSystemID, solarSystemName, x, y, z, security from mapsolarsystems"
):
    id, name, x, y, z, security = row
    systems.append(
        {"id": id, "name": name, "x": x, "y": y, "z": z, "security": security}
    )

with open("new.json", "w+") as f:
    ujson.dump(
        systems,
        f,
        indent=2,
        sort_keys=True,
    )
