const log = console.log;
const chars = "QWERTZUIOPASDFGHJKLYXCVBNMqtzuioasdfghjkyxcvbnm1234567890"

function randomBytes(l) {
    var str = ""

    for (let index = 0; index < l; index++) {
        str += chars[Math.floor(Math.random() * chars.length)]
    }

    return chars
}

class Client {

    #rawSocket = false

    #obj = {
        on: {
            get: {
                "API\nISSTREAMEND?": key =>
                    this.#obj.streamEnd?.[key] ?? true
            },
            say: {
                "API\nOnStreamEnd": key => {
                    this.#obj.on.streamEnd?.[key]?.();
                }
            },
            stream: {},
            streamEnd: {},
        },
        getPromises: {},
        streamEnd: {},
    }

    constructor(url) {

        this.#rawSocket = new WebSocket(url)

        this.getState = () => this.#rawSocket.readyState;

        this.close = () => this.#rawSocket.close()

        this.#rawSocket.onclose = code => {
            this.onclose(code)
        }

        this.#rawSocket.onerror = err => {
            this.onerror(err)
        }

        this.#rawSocket.onend = () => {
            this.onend()
        }

        this.#rawSocket.onopen = () => {
            this.onopen()
        }

        this.#rawSocket.onmessage = chunk => {
            this.#onmessage(chunk)
        }

    }

    //noraml listeners

    onSay(key, handler) {

        this.#obj.on.say[key] = handler;

    }

    onGet(key, handler) {

        this.#obj.on.get[key] = handler;

    }

    //streams and stream listener

    onStream(key, chunkHandler, onEndHandler) {

        this.#obj.on.stream[key] = chunkHandler;
        this.#obj.on.streamEnd[key] = () => {
            onEndHandler();
            delete this.#obj.on.streamEnd[key];
            delete this.#obj.on.stream[key];
        };

    }

    isStreamEnd = async key =>
        await this.get("API\nISSTREAMEND?", key) ? true : false

    endStream(key) {

        this.#obj.streamEnd[key] = true;
        this.say("API\nOnStreamEnd", key);

    }

    streamChunk(key, chunk) {

        this.#send("stream", key, chunk, false);
        this.#obj.streamEnd[key] = false;

    }

    //Normal Methodas

    say(key, data) {

        this.#send("say", key, data, false);

    }

    get(key, data) {

        var id = randomBytes(8);

        return new Promise((reslove) => {

            this.#obj.getPromises[id] = res => {
                delete this.#obj.getPromises[id];
                reslove(res);
            };

            this.#send("get", key, data, id)

        })

    }

    //Send and Onmessage

    #onmessage({ data }) {

        try {

            var data = JSON.parse(data);

            //onSay
            if (data?.method == "say" && data?.key) {
                if (this.#obj.on.say?.[data.key])
                    this.#obj.on.say[data.key](data?.cont)
            }
            //onGet
            else if (data?.method == "get" && data?.key && data?.id) {

                const sendBack = cont => {
                    this.#send("getback", false, cont, data.id)
                }

                if (!this.#obj.on.get[data?.key])
                    return sendBack("404")

                var res = this.#obj.on.get[data?.key](data?.cont)

                if (res instanceof Promise) {
                    res.then(res => sendBack(res))
                } else {
                    sendBack(res)
                }

            }
            //For getting data Back
            else if (data?.method == "getback" && data?.id) {
                if (this.#obj.getPromises[data.id])
                    this.#obj.getPromises[data.id](data?.cont);
            }
            //onStream
            else if (data?.method == "stream" && data?.key) {
                if (this.#obj.on.stream?.[data?.key])
                    this.#obj.on.stream[data?.key](data?.cont)
            }
            //on ?
            else log(data)

        } catch (error) {
            console.error(error);
        }

    }

    #send(method, key, cont, id) {

        var data = {
            method,
            cont
        }

        if (key) data.key = key
        if (id) data.id = id;

        this.#rawSocket.send(JSON.stringify(data))

    }

    //Other Handlers

    onclose() { }
    onopen() { }
    onerror() { }
    onend() { }

}

var user = localStorage.getItem("messenger-user") || false;
var password = localStorage.getItem("messenger-password") || false;
var contacts = JSON.parse(localStorage.getItem(":messenger-contacts:")) || {}
contacts[user] = "You"

const messagesDiv = document.getElementById("messages")
const sendForm = document.querySelector("#send-form form")
const sendTextarea = document.querySelector("#send-form form textarea")
sendForm.onsubmit = e => e.preventDefault()

var messages = []
const url = new URL(document.location)

if (!url.searchParams.get("room"))
    window.history.back();

var API = new Client(document.location.protocol == "file:" ? "ws://localhost:2112" : "wss://wfrx3h-2112.csb.app")
API.onclose = () => window.location.reload()
API.onerror = () => window.location.reload()

API.onopen = async () => {

    if (!user || !password) {

        var data = await API.get("CreateUser")
        user = data.user;
        password = data.password;
        localStorage.setItem("messenger-user", user)
        localStorage.setItem("messenger-password", password)

    }

    if (await API.get("auth", { user, password })) {

        start()

    }

    else {

        var id = randomBytes(5)
        localStorage.setItem("lastUser" + id, user)
        localStorage.setItem("lastPassword" + id, password)
        if (confirm("Your user does not exists. Do you want to create a new user?")) {
            localStorage.removeItem("messenger-user");
            window.location.reload()
        }

    }

}

window.addEventListener("focusin", e => {
    sendTextarea.focus()
})

async function start() {

    const room = url.searchParams.get("room")

    renderChatt();

    API.say("join", room)

    API.onSay("incoming message", msg => {

        messages.push(msg);
        renderChatt();

    })

    API.onSay("reload", () => reloadChatt())

    function reloadChatt() {
        messages = []
        renderChatt()
    }

    //Sending Messages
    sendForm.onsubmit = e => {

        e.preventDefault()
        sendMessage()

    }

    window.addEventListener("keydown", ({ key }) => {
        if (key.toLowerCase() == "escape")
            sendMessage()
        sendTextarea.focus()
    })


    function sendMessage() {

        if (sendTextarea.value == "") return
        //creating the message
        var msg = {
            type: "text",
            data: sendTextarea.value,
            date: new Date().toLocaleString(),
            user
        }
        //pushing the message
        messages.push(msg)
        renderChatt()
        if (API.getState() == 1) sendTextarea.value = "";
        API.say("send message", msg)
        log("send : " + sendTextarea.value)

    }

    function renderChatt() {

        messagesDiv.innerHTML = "";
        var _user = user

        messages.map(({ type, data, user, date }, i) => {
            //create message element
            var elem = document.createElement("div")
            elem.classList.add("msg")
            var dataElem = document.createElement("div")
            var footerElem = document.createElement("div")
            elem.appendChild(dataElem)
            elem.appendChild(footerElem)

            footerElem.title = "click to change name"
            footerElem.classList.add("msg-footer")

            if (user == _user)
                elem.classList.add("mymsg")

            footerElem.innerText =
                `${contacts?.[user] ?? user} ${date}`

            if (type == "text")
                dataElem.innerText = data;
            else if (type == "info") {
                footerElem.innerText += data == "joined" ? " joind" : " exit"
                elem.style.border = "none"
                elem.style.padding = 0
                elem.style.margin = "3px 20px"
            }
            else if (type == "active user") {
                dataElem.innerText = "active user : \n-" + data.map(id => contacts[id] ?? id).join("\n-");
                elem.style.width = "calc(100% - 35px)"
            }

            footerElem.addEventListener("click", e => {
                e.preventDefault()
                if (!confirm("Do you want to change the name???")) return
                contacts[user] = prompt("new name :")
                localStorage.setItem(":messenger-contacts:", JSON.stringify(contacts))
                renderChatt()
            })

            messagesDiv.appendChild(elem)
            if (i == messages.length - 1)
                elem.scrollIntoView({ behavior: "smooth", block: "center" })
        })

    }

}