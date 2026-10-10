# Import all models here so that SQLAlchemy's Base.metadata knows about
# every table.  main.py imports this module before calling Base.metadata.create_all().
from backend.app.models.user import User
from backend.app.models.user_session import UserSession
from backend.app.models.client import Client
from backend.app.models.booking import Booking
from backend.app.models.event import Event
from backend.app.models.photo import Photo
from backend.app.models.photo_analysis import PhotoAnalysis
from backend.app.models.culling_override import CullingOverride
