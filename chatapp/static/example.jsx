class User {
    id;
    connectedDevices = [];
    current;
    messages = [];
    privatekey;
    publicKey;
    sharedKey;
    constructor(id) {
        this.id = id;
        this.current = 'none';
        mobx.makeObservable(this, {
            id: mobx.observable,
            current: mobx.observable,
            connectedDevices: mobx.observable,
            messages: mobx.observable,
            addConnection: mobx.action,
            removeConnection: mobx.action,
            addMessage: mobx.action,
            isConnected: mobx.computed,
        });
    }

    addConnection(uID) {
        const ind = this.connectedDevices.indexOf(uID);
        console.log(ind);
        if (ind === -1) {
            console.log("connected buddy");
            this.connectedDevices.push(uID);
        }
    }

    removeConnection(uID) {
        const ind = this.connectedDevices.indexOf(uID);
        if (ind > -1) {
            this.connectedDevices.splice(ind, 1);
        }
    }

    get isConnected() {
        if (this.connectedDevices.length > 0) {
            return true;
        }
        return false;
    }

    addMessage(content, sender, reciever, date) {
        this.messages.push(
            new Message(this.messages.length, content, sender, reciever, date)
        );
    }
}

class Message {
    id;
    content;
    sender;
    reciever;
    date;
    constructor(id, content, sender, reciever, date) {
        this.content = content;
        this.sender = sender;
        this.reciever = reciever;
        this.date = date;
    }
}

async function dh() {
    let keyPair = await window.crypto.subtle.generateKey(
        {
            name: "ECDH",
            namedCurve: "P-384",
        },
        false,
        ["deriveKey"]
    );
    return keyPair;
}

async function exportKey(key) {
    return await window.crypto.subtle.exportKey("jwk", key);
}

async function importKey(jwk) {
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        {
            name: "ECDH",
            namedCurve: "P-384",
        },
        false,
        []
    );
}

async function deriveSecretKey(privateKey, publicKey) {
    return await window.crypto.subtle.deriveKey(
        {
            name: "ECDH",
            public: publicKey,
        },
        privateKey,
        {
            name: "AES-GCM",
            length: 256,
        },
        false,
        ["encrypt", "decrypt"]
    );
}

var clientSocket = io("http://127.0.0.1:5000");
let clientId;
let redirect = false;
const currentUser = new User("none");

const Link = ReactRouterDOM.Link;
const Route = ReactRouterDOM.Route;
const { observer } = mobxReact;
const dec = new TextDecoder();
const enc = new TextEncoder();

clientSocket.on("connect", function () {});

clientSocket.on("message", async function (data) {
    console.log("Recieved message from " + data.sender + ": " + data.content);
    let iv = data.iv;
    let decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        currentUser.sharedKey,
        data.content
    );
    let content = dec.decode(decrypted);
    currentUser.addMessage(content, data.sender, data.reciever, data.date);
});

clientSocket.on("connected_successfully", async function (data) {
    redirect = true;
    let result = await establishConnection(data);
    if (!result) {
        redirect = false;
        return;
    }
    redirect = false;
});

async function establishConnection(data) {
    if (currentUser.isConnected) {
        return;
    }
    currentUser.addConnection(data.id);
    currentUser.current = data.id;
    let friend_key = await importKey(data.key);
    currentUser.sharedKey = await deriveSecretKey(
        currentUser.privatekey,
        friend_key
    );
    return true;
}

clientSocket.on("connect_request", async function (data) {
    redirect = true;
    let result = await establishConnection(data);

    console.log("result is " + result);
    if (!result) {
        redirect = false;
        return;
    }
    redirect = false;
    let pub_key = await exportKey(currentUser.publicKey);
    clientSocket.emit("accepted", {
        id: currentUser.id,
        key: pub_key,
        friend_id: data.id,
    });
});

class Header extends React.Component {
    state = {};
    render() {
        return (
            <React.Fragment>
                <nav className="navbar navbar-expand-lg navbar-light bg-light">
                    <a href="#" className="navbar-brand">
                        ChatApp
                    </a>
                    <button
                        className="navbar-toggler"
                        type="button"
                        data-toggle="collapse"
                        data-target="#navbarSupportedContent"
                        aria-expanded="false"
                        aria-label="Toggle navigation"
                    >
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div
                        className="collapse navbar-collapse"
                        id="navbarSupportedContent"
                    >
                        <ul className="navbar-nav mr-auto">
                            <li className="nav-item active"></li>
                        </ul>
                    </div>
                </nav>
            </React.Fragment>
        );
    }
}

const MainBody = observer((props) => {
    if (props.currentUser.isConnected && redirect) {
        console.log(props.currentUser.isConnected);
        const history = ReactRouterDOM.useHistory();
        history.push("/message/" + props.currentUser.connectedDevices[0]);
    }
    return (
        <React.Fragment>
            <Header />
            <div>
                <div className="content-section">
                    <h1>Welcome to ChatApp</h1>
                    <h2>Your Session Id is: {props.currentUser.id}</h2>
                    <p>Please enter a valid session id to start chatting.</p>
                    <input className="form-control" id="sess_id"></input>
                    <ConnectButton currentUser={props.currentUser} />
                    <hr />
                </div>
            </div>
        </React.Fragment>
    );
});

const ChatBody = observer((props) => {
    const sendMessage = async () => {
        let message = document.getElementById("messageBox").value;
        console.log("Message is " + message);
        
        let sender = props.currentUser.id;
        let reciever = props.currentUser.current;
        let date = "notImplemented";
        props.currentUser.addMessage(message, sender, reciever, date);
        message = enc.encode(message);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        let content = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            props.currentUser.sharedKey,
            message
        );
        clientSocket.emit(
            "message",
            {
                sender: sender,
                reciever: reciever,
                content: content,
                date: date,
                iv: iv,
            },
            (response) => {
                console.log("Message sent");
            }
        );
        document.getElementById("messageBox").value = "";
    };

    return (
        <React.Fragment>
            <Header />
            <h1>You are chatting with user: {props.currentUser.current}</h1>
            <div className="container">
                <div className="body">
                    {props.currentUser.messages.map((message, index) => {
                        return message.sender === props.currentUser.id ? (
                            <p className="message user_message" key={index}>
                                {message.content}
                            </p>
                        ) : (
                            <p className="message" key={index}>
                                {message.content}
                            </p>
                        );
                    })}
                </div>
                <div className="footer">
                    <input type="text" id="messageBox" />
                    <button onClick={sendMessage}>SEND</button>
                </div>
            </div>
        </React.Fragment>
    );
});

const App = observer((props) => {
    return (
        <ReactRouterDOM.HashRouter>
            <Route
                path="/"
                exact
                render={() => <MainBody currentUser={props.currentUser} />}
            />
            {props.currentUser.connectedDevices.map((user, index) => (
                <Route
                    key={index}
                    path={`/message/${user}`}
                    render={() => <ChatBody currentUser={props.currentUser} />}
                />
            ))}
        </ReactRouterDOM.HashRouter>
    );
});

function ConnectButton(props) {
    const user = props.currentUser;
    async function get_sess_id() {
        let id = document.getElementById("sess_id").value;
        if (user.isConnected) {
            return;
        }
        console.log(currentUser.privatekey);
        let pub_key = await exportKey(currentUser.publicKey);
        console.log(pub_key);
        clientSocket.emit(
            "connect_request",
            { id: id, key: pub_key },
            (response) => {
                if (!response) {
                    alert("No such User!!!");
                }
            }
        );
        document.getElementById("sess_id").value = "";
    }

    return (
        <button className="btn btn-outline-info" onClick={get_sess_id}>
            Submit
        </button>
    );
}

clientSocket.on("first_delivery", function (data) {
    clientId = data.id;
    currentUser.id = data.id;
});

async function initialize() {
    let keys = await dh();
    currentUser.publicKey = keys.publicKey;
    currentUser.privatekey = keys.privateKey;
}

initialize();
ReactDOM.render(
    <App currentUser={currentUser} />,
    document.getElementById("root")
);
