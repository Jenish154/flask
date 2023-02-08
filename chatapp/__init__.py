from os import path
from flask import Flask
from flask_socketio import SocketIO


app = Flask(__name__)
app.config['SECRET_KEY'] = 'djskhfksdjhfdsjhjdsfh'


server_socket = SocketIO(app)

from .routes import *
