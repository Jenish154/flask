from chatapp import app, server_socket
if __name__ == '__main__':
    #create_database(app = app)
    server_socket.run(app, debug=True)

