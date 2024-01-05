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

const messagesDiv = document.getElementById("messages")
const sendForm = document.querySelector("#send-form form")
const sendTextarea = document.querySelector("#send-form form textarea")
const sendType = document.getElementById("send-type")
sendForm.onsubmit = e => e.preventDefault()

const url = new URL(document.location)

if (!url.searchParams.get("room"))
    window.history.back();

sendTextarea.value = localStorage.getItem("messenger-room-value-" + url.searchParams.get("room")) || ""

sendTextarea.addEventListener("input", e => localStorage.setItem("messenger-room-value-" + url.searchParams.get("room"), e.target.value))

var API = new Client(false ? "ws://localhost:2112" : "wss://wfrx3h-2112.csb.app")
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

        contacts[user] = "You"

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

window.addEventListener("focusin", e => sendTextarea.focus())

async function start() {

    const room = url.searchParams.get("room")

    //To Join the right room
    API.say("join", room)

    localStorage.setItem("messenger-rooms-visited", JSON.stringify({
        ...(JSON.parse(localStorage.getItem("messenger-rooms-visited") ?? "{}")),
        [room]: room
    }))

    //Sending Message on Submit
    sendForm.onsubmit = e => {

        e.preventDefault()
        sendMessage()

    }

    //Sendin Message on Keydown
    window.addEventListener("keydown", ({ key }) => {
        if (key.toLowerCase() == "escape")
            sendMessage()
        sendTextarea.focus()
    })

}

API.onSay("incoming message", msg => {

    if (msg.type == "delete") {
        if (document.getElementById(msg.id))
            messagesDiv.removeChild(document.getElementById(msg.id))
        messages = messages.filter(_msg => _msg.id != msg.id)
        return;
    }

    renderChatt(msg);

})

API.onSay("reload", () => reloadChatt())

API.onSay("totalreload", () => window.location.reload())

function reloadChatt() {
    messagesDiv.innerHTML = ""
}

function sendMessage() {

    if (sendTextarea.value == "") return
    //reseting the localstorage text
    localStorage.setItem("messenger-room-value-" + url.searchParams.get("room"), "")
    //creating the message
    var msg = {
        type: sendType.value,
        data: sendTextarea.value,
        date: new Date().toLocaleString(),
        user,
    }
    //pushing the message
    renderChatt({
        ...msg,
        id: randomBytes(8),
    })
    if (API.getState() == 1) sendTextarea.value = "";
    API.say("send message", msg)
    log("send : " + sendTextarea.value)

}

var isFirstRender = true

function renderChatt(msg) {

    //clear the message div
    if (isFirstRender) {
        messagesDiv.innerHTML = "";
        isFirstRender = false
    }

    renderMessage(msg)

    //messages.map(renderMessage)

}

var _user = user
var RenderedMessages = {}
var canScrollToNewMsg = true
messagesDiv.addEventListener("scroll", e => {
    canScrollToNewMsg = messagesDiv.scrollHeight - innerHeight < e.target.scrollTop + innerHeight / 2
})

var renderMessage = ({ type, data, user, date, id }, i) => {

    //create message element
    var elem = document.createElement("div")
    elem.setAttribute("id", id)
    elem.classList.add("msg")

    var dataElem = document.createElement("div")
    var footerElem = document.createElement("div")
    elem.appendChild(dataElem)
    elem.appendChild(footerElem)


    //to change The name
    footerElem.addEventListener("click", e => {
        e.preventDefault()
        if (!confirm("Do you want to change the name???")) return
        contacts[user] = prompt("new name :")
        localStorage.setItem(":messenger-contacts:", JSON.stringify(contacts))
        window.location.reload()
    })

    if (user == _user) {
        //render menu
        var deleteMsgButton = document.createElement("div")
        deleteMsgButton.classList.add("menu")
        deleteMsgButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>`
        elem.appendChild(deleteMsgButton)
        //to delete on dbclick
        deleteMsgButton.addEventListener("click", async e => {
            e.preventDefault()
            if (user != _user) return
            if (!confirm("Delete Message")) return
            if (!(await API.get("delete message", id))) window.location.reload();
        })
        //chage color of my message
        elem.classList.add("mymsg")
        //remove dlete button on other messagetypes
        if (type == "info" || type == "active user")
            elem.removeChild(deleteMsgButton)
    }

    if (!RenderedMessages[id])
        elem.classList.add("msg-anim")

    footerElem.title = "click to change name"
    footerElem.classList.add("msg-footer")

    footerElem.innerText =
        `${contacts?.[user] ?? user} ${date}`

    if (type == "text")
        dataElem.innerText = data;
    else if (type == "link") {
        var data = isUrl(data)
        if (!data) return
        var link = document.createElement("a")
        link.href = data;
        link.innerText = link;
        link.target = "_blank"
        dataElem.appendChild(link)
    } else if (type == "iframe") {
        try {
            var data = isUrl(data)
            if (!data) return
            var iframe = document.createElement("iframe")
            iframe.classList.add("msg-iframe")
            iframe.src = data;
            dataElem.appendChild(iframe);
        } catch (error) {

        }
    } else if (type == "html") {
        try {
            var iframe = document.createElement("iframe")
            iframe.classList.add("msg-iframe")
            var data = data
                .split("<script").join("< script")
                .split("</script").join("< /script")
            var data = `<style>*{
            background-color: #e9f3ea;
            color: black;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }</style>
        <script>
        window.alert=x=>log(x)
        window.prompt=x=>log(x)
        window.confirm=x=>log(x)
        </script>`
                + data;

            var blob = new Blob([data], { type: "text/html" })
            var fr = new FileReader()

            fr.onload = () => {
                iframe.src = fr.result;
            }

            fr.readAsDataURL(blob)
            dataElem.appendChild(iframe);
        } catch (error) {

        }
    }
    else if (type == "info") {
        footerElem.innerText += data == "joined" ? " joined" : " exit"
        elem.style.border = "none"
        elem.style.padding = "5px"
        elem.style.borderRadius = "5px"
        elem.style.margin = "1px 20px"
        elem.style.width = "max-content"
    }
    else if (type == "active user") {
        dataElem.innerText = "active user : \n-" + data.map(id => contacts[id] ?? id).join("\n-");
        elem.style.width = "calc(100% - 35px)"
        elem.removeChild(footerElem)
    }

    messagesDiv.appendChild(elem)

    //scroll messages into view
    if (canScrollToNewMsg)
        elem.scrollIntoView({ behavior: "smooth", block: "center" })

    RenderedMessages[id] = true
}

function isUrl(text) {
    try {
        var url = new URL(text)
        return url
    } catch (error) {
        try {
            var url = new URL("https://" + text)
            return url
        } catch (error) {
            return false
        }
    }
}