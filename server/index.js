const { createServer, Client } = require("./_server");

const log = console.log;
const { randomBytes } = require("crypto");
const fs = require("fs");
const _path = require("path");

function store(path, data) {
  var path = "data/" + path + ".data";
  if (!fs.existsSync(_path.dirname(path)))
    fs.mkdirSync(_path.dirname(path), { recursive: true });
  return fs.writeFileSync(path, JSON.stringify(data), "utf-8");
}

function deleteData(path) {
  if (fs.existsSync("data/" + path + ".data"))
    fs.unlinkSync("data/" + path + ".data");
  else return false;
}

function get(path) {
  if (fs.existsSync("data/" + path + ".data"))
    return JSON.parse(fs.readFileSync("data/" + path + ".data", "utf-8"));
  else return false;
}

var rooms = {};

createServer({ port: 2112 }, async (client) => {
  var isAuth = false;
  var id = randomBytes(5).toString("base64url");
  var room = false;
  var user = false;

  client.onSay("delete chatt", () => {
    if (!isAuth || !user || !room) return;
    store("chats/" + room, []);
    Object.keys(rooms[room]).forEach((userKey) => {
      Object.keys(rooms[room][userKey]).forEach((userIdKey) => {
        if (!(rooms[room][userKey][userIdKey] instanceof Client)) return;
        rooms[room][userKey][userIdKey].say("reload");
      });
    });
  });

  client.onGet("CreateUser", () => createUser());

  client.onGet("auth", (data) => {
    isAuth = auth(data);
    if (isAuth) user = data?.user;
    return isAuth;
  });

  client.onSay("join", (client_room) => {
    room = client_room;

    if (!isAuth || !user) return;
    if (!rooms?.[room]) rooms[room] = { [user]: { [id]: client } };
    else if (!rooms[room]?.[user]) rooms[room][user] = { [id]: client };
    else if (rooms[room][user]) rooms[room][user][id] = client;

    var chattData = get("chats/" + client_room);

    client.say("incoming message", {
      type: "active user",
      data: Object.keys(rooms[room]),
      user,
      date: new Date().toLocaleString(),
    });

    if (!chattData) {
      store("chats/" + client_room, []);
    } else {
      chattData.forEach((msg) => {
        client.say("incoming message", msg);
      });
    }

    Object.keys(rooms[room]).forEach((userKey) => {
      Object.keys(rooms[room][userKey]).forEach((userIdKey) => {
        if (userKey == user && userIdKey == id) return;
        if (!(rooms[room][userKey][userIdKey] instanceof Client)) return;
        rooms[room][userKey][userIdKey].say("incoming message", {
          type: "info",
          data: "joined",
          user,
          date: new Date().toLocaleString(),
        });
      });
    });
  });

  client.onSay("send message", (data) => {
    if (!isAuth || !user || !room) return;
    if (!data?.type || !data?.data) return;
    var msg = {
      type: data?.type,
      data: data?.data,
      user,
      date: new Date().toLocaleString(),
    };
    Object.keys(rooms[room]).forEach((userKey) => {
      Object.keys(rooms[room][userKey]).forEach((userIdKey) => {
        if (userKey == user && userIdKey == id) return;
        if (!(rooms[room][userKey][userIdKey] instanceof Client)) return;
        rooms[room][userKey][userIdKey].say("incoming message", msg);
      });
    });
    store("chats/" + room, [...get("chats/" + room), msg]);
  });

  client.onclose = () => close();
  client.onerror = () => close();

  function close() {
    if (rooms?.[room]?.[user]?.[id]) delete rooms[room][user][id];
    if (rooms?.[room]?.[user])
      if (Object.keys(rooms?.[room]?.[user]).length == 0)
        delete rooms[room][user];
    if (rooms[room])
      Object.keys(rooms[room]).forEach((userKey) => {
        Object.keys(rooms[room][userKey]).forEach((userIdKey) => {
          if (userKey == user && userIdKey == id) return;
          if (!(rooms[room][userKey][userIdKey] instanceof Client)) return;
          rooms[room][userKey][userIdKey].say("incoming message", {
            type: "info",
            data: "exit",
            user,
            date: new Date().toLocaleString(),
          });
        });
      });
  }
});

setInterval(() => {
  log(rooms);
}, 5000);

function auth(data) {
  if (!data?.user || !data?.password) return false;
  var userData = get("user/" + data?.user);
  if (!userData) return false;
  if (userData?.password == data?.password) return true;
  else return false;
}

function createUser() {
  const user = randomBytes(10).toString("base64url");
  const password = randomBytes(30).toString("base64url");

  store("user/" + user, {
    password,
  });

  return {
    user,
    password,
  };
}

process.on("uncaughtException", (err) => console.error(err));
