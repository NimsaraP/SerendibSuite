import urllib.request, json

res = urllib.request.urlopen("http://127.0.0.1:8000/api/events/")
events = json.loads(res.read().decode())
print(f"Total Events: {len(events)}")
for e in events:
    print(f"#{e['id']}: {e['name']} | Date: {e['event_date']} | Time: {e.get('event_time')} | Loc: {e.get('location')}")
