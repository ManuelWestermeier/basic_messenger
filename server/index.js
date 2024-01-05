const { createServer, Client } = require("./_server");

const log = console.log;
const { randomBytes } = require("crypto");
const fs = require("fs");
const _path = require("path");

function store(path, data) {
  try {
    var path = "data/" + path + ".data";
    if (!fs.existsSync(_path.dirname(path)))
      fs.mkdirSync(_path.dirname(path), { recursive: true });
    return fs.writeFileSync(path, JSON.stringify(data), "utf-8");
  } catch (error) {

  }
}

function deleteData(path) {
  if (fs.existsSync("data/" + path + ".data"))
    fs.unlinkSync("data/" + path + ".data");
  else return false;
}

function get(path) {
  try {
    if (fs.existsSync("data/" + path + ".data"))
      return JSON.parse(fs.readFileSync("data/" + path + ".data", "utf-8"));
    else return false;
  } catch (error) {

  }
}

const rooms = {};

createServer({ port: 2112 }, async (client) => {
  var isAuth = false;
  var id = randomBytes(5).toString("base64url");
  var room = false;
  var user = false;

  client.onSay("delete chatt", () => {
    try {
      if (!isAuth || !user || !room) return;
      store("chats/" + room, []);
      Object.keys(rooms[room]).forEach((userKey) => {
        Object.keys(rooms[room][userKey]).forEach((userIdKey) => {
          if (!(rooms[room][userKey][userIdKey] instanceof Client)) return;
          rooms[room][userKey][userIdKey].say("reload");
        });
      });
    } catch (error) {

    }
  });

  client.onGet("CreateUser", () => createUser());

  client.onSay("join", (client_room) => {
    try {
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
        id: randomBytes(8).toString("base64url"),
      });

      if (!chattData)
        store("chats/" + client_room, []);
      else chattData.forEach((msg) => client.say("incoming message", msg));

      Object.keys(rooms[room]).forEach((userKey) => {
        Object.keys(rooms[room][userKey]).forEach((userIdKey) => {
          if (userKey == user && userIdKey == id) return;
          if (!(rooms[room][userKey][userIdKey] instanceof Client)) return;
          rooms[room][userKey][userIdKey].say("incoming message", {
            type: "info",
            data: "joined",
            user,
            date: new Date().toLocaleString(),
            id: randomBytes(8).toString("base64url"),
          });
        });
      });
    } catch (error) {

    }
  });

  client.onGet("auth", (data) => {
    try {
      isAuth = auth(data);
      if (isAuth) user = data?.user;
      return isAuth;
    } catch (error) {

    }
  })

  client.onGet("delete message", id => {
    try {
      if (!id) return false
      if (!isAuth || !user || !room) return false;
      var data = get("chats/" + room)
      var data2 = data.filter(msg => !(msg.id == id && msg.user == user))
      if (data.length == data2.length) return false;
      Object.keys(rooms[room]).forEach((userKey) => {
        Object.keys(rooms[room][userKey]).forEach((userIdKey) => {
          if (userKey == user && userIdKey == id) return;
          if (!(rooms[room][userKey][userIdKey] instanceof Client)) return;
          rooms[room][userKey][userIdKey].say("incoming message", {
            type: "delete",
            id,
          });
        });
      });
      store("chats/" + room, data2);
      return true
    } catch (error) {

    }
  })

  client.onSay("send message", (data) => {
    try {
      if (!isAuth || !user || !room) return;
      if (!data?.type || !data?.data) return;
      var msg = {
        type: data?.type,
        data: data?.data,
        user,
        date: new Date().toLocaleString(),
        id: randomBytes(8).toString("base64url"),
      };
      Object.keys(rooms[room]).forEach((userKey) => {
        Object.keys(rooms[room][userKey]).forEach((userIdKey) => {
          if (userKey == user && userIdKey == id) return;
          if (!(rooms[room][userKey][userIdKey] instanceof Client)) return;
          rooms[room][userKey][userIdKey].say("incoming message", msg);
        });
      });
      store("chats/" + room, [...get("chats/" + room).filter((x, i) => i < 500), msg]);
    } catch (error) {

    }
  });

  client.onclose = () => close();
  client.onerror = () => close();

  function close() {
    try {
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
              id: randomBytes(8).toString("base64url"),
            });
          });
        });
    } catch (error) {

    }
  }
});

function auth(data) {
  try {
    if (!data?.user || !data?.password) return false;
    var userData = get("user/" + data?.user);
    if (!userData) return false;
    if (userData?.password == data?.password) return true;
    else return false;
  } catch (error) {

  }
}

function createUser() {
  try {
    const user = randomBytes(10).toString("base64url");
    const password = randomBytes(30).toString("base64url");

    store("user/" + user, {
      password,
    });

    return {
      user,
      password,
    };
  } catch (error) {

  }
}

process.on("uncaughtException", (err) => console.error(err));

setInterval(() => {

  try {
    Object.keys(rooms).forEach(room => {
      Object.keys(rooms[room]).forEach((userKey) => {
        Object.keys(rooms[room][userKey]).forEach((userIdKey) => {
          if (!(rooms[room][userKey][userIdKey] instanceof Client)) return;
          rooms[room][userKey][userIdKey].say("totalreload");
        });
      });
      delete rooms[room]
    })
  } catch (error) {

  }

}, 24000 * 3600)