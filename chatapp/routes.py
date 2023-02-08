from flask import render_template, request, flash, make_response
from chatapp import server_socket, app

class Message:
    def __init__(self, sender: str, reciever: str, content: str, date: str) -> None:
        self.sender = sender
        self.reciever = reciever
        self.content = content
        self.date = date

class User:
    def __init__(self, id: str) -> None:
        self.id = id
        self._connected_devices = []
        self.messages: list[Message] = []
    
    def add_connection(self, user) -> None:
        if user.id == self.id:
            return
        if user.id in self._connected_devices:
            return
        self._connected_devices.append(user)
    
    def remove_connection(self, user) -> None:
        self._connected_devices.remove(user)

    def is_connected(self, user) -> bool:
        if user in self._connected_devices:
            return True
        return




connected_devices: list[User] = []

def find_user(id: str) -> User:
    for user in connected_devices:
        if user.id == id:
            return user
    else:
        print('USER NOT FOUND')

@server_socket.on('connect')
def connected():
    flash('{request.sid} connected', 'success')
    print(f'{request.sid} connected')
    print(type(request.sid))
    id = request.sid
    new_user = User(id)
    connected_devices.append(new_user)
    server_socket.emit('first_delivery', {'id': request.sid}, to=request.sid)

@server_socket.on('disconnect')
def disconnect():
    print(f'{request.sid} disconnected')
    user = find_user(request.sid)
    connected_devices.remove(user)

@server_socket.on("connect_request")
def verify_connect_request(data):
    print("[NEW_CONNECT_REQUEST]", data)
    id = data['id']
    user = find_user(id)
    if user:
        #curr_user = find_user(request.sid)
        #curr_user.add_connection(user)
        #print('CONNECTION ADDED')
        server_socket.emit('connect_request', {'id': request.sid, 'key':data['key']}, to=id, callback = connect_callback)
        print('REQUEST SENT')
        #server_socket.emit('connected_successfully', {'id': request.sid}, to=user.id)
        return True

    else:
        print('stop slacking!!!')
        return False

@server_socket.on('accepted')
def connect_callback(data):
    if data:
        print("callback data is", data)
        curr_user = find_user(data["id"])
        friend_id = find_user(data["friend_id"])
        curr_user.add_connection(friend_id)
        print("CONNECTION_ADDED")
        data = {"id": data['id'], 'key': data["key"]}
        server_socket.emit("connected_successfully", data, to=friend_id.id)

@server_socket.on('message')
def handle_message(data):
    print("[NEW_MESSAGE]", data)
    server_socket.emit("message", data, to = data['reciever'])
    return True

@app.route('/')
def landing():
    return render_template("home.html")