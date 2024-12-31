import {Server, Socket} from "socket.io";
import {v4 as uuidv4} from "uuid";
import {assignRolesAndWords, fetchWords} from "./gameLogic";
import {Room, User} from "./types";

const io = new Server(3060, {
    cors: {
        origin: "*",
    },
});
const rooms: Map<string, Room> = new Map();

interface ClientMessage {
    type: string;
    roomId?: string;
    nickname?: string;
    userId?: string;
    voteFromId?: string;
    oprateUser?: User[];
    candidateUser?: User[];
}

// 定义聊天消息的接口
interface ChatMessage {
    roomId: string;
    id: string;
    userId: string;
    userName: string;
    content: string;
}

const userSocketMap: Map<string, string> = new Map();

io.on("connection", (socket: Socket) => {
    console.log("Socket.io connection established");

    socket.on("create_room", (data: { roomId: string }) => {
        const {roomId} = data;
        if (rooms.has(roomId)) {
            socket.emit("room_exist", {message: "房间已存在"});

            socket.join(roomId);
            console.log("room_exist", roomId);
            return;
        }

        console.log("create_room", roomId);
        const room: Room = {roomId, users: [], host: ""};
        rooms.set(roomId, room);
        socket.join(roomId);
        socket.emit("room_created", {room});
        setTimeout(() => {
            rooms.delete(roomId);
        }, 2 * 60 * 60 * 1000);
    });



    socket.on("start_game", async (data: { roomId: string, isOpenBlank: boolean}) => {
        const {roomId,isOpenBlank} = data;
        const room = rooms.get(roomId);

        if (room && room.users.length >= 3) {
            try {
                const words = await fetchWords();
                const updatedUsers = assignRolesAndWords(room.users, words, isOpenBlank);
                room.users = updatedUsers;

                rooms.set(roomId, room);
                io.to(roomId).emit("game_started", {users: updatedUsers, roomId});
            } catch (error) {
                socket.emit("error", {message: "分配词语失败"});
            }
        } else {
            socket.emit("error", {message: "人数不足，无法开始游戏"});
        }
    });

    socket.on("exit_room", (data: { roomId: string, userId: string }) => {
        const {roomId, userId} = data;
        const room = rooms.get(roomId);
        if (room) {
            room.users = room.users.filter((user) => user.id !== userId);
            if (room.users.length === 0) {
                rooms.delete(roomId);
                return;
            }
            room.host = room.users[0]?.id || "";
            rooms.set(roomId, room);
            io.to(roomId).emit("room_update", {room, roomId});
        }
    });

    socket.on("get_room_info", (data: { roomId: string, userId: string }) => {
        const {roomId, userId} = data;
        const room = rooms.get(roomId);

        // 如果socket没有加入房间，则加入房间
        if (!socket.rooms.has(roomId)) {
            // 第一次进来
            socket.join(roomId);
        }
        // 曾经来过
        if (userId != undefined && userId != null && userId != "" && userId != "undefined") {
          //Store the mapping of user.id to socket.id
            userSocketMap.set(userId, socket.id);
        }
        socket.emit("room_info", {room});
    });

    socket.on("join_room", (data: { roomId: string, nickname?: string }) => {
        const {roomId, nickname} = data;
        const userId = uuidv4();
        const room = rooms.get(roomId);
        const user: User = {id: userId, nickname: nickname || `玩家${userId.slice(0, 4)}`};

        if (room) {
            // 移除没有连接的用户
            room.users = room.users.filter((user) => {
                const socketId = userSocketMap.get(user.id);
                return socketId && io.sockets.sockets.get(socketId);
            });
            // 如果移除没有连接的用户之后没有房主，则重新设置房主
            if (!room.users.some((user) => user.id === room.host)) {
                room.host = room.users[0]?.id || "";
            }

            room.users.push(user);
            if (!room.host) room.host = userId;
        } else {
            socket.emit("error", {message: "房间不存在"});
            return;
        }

        // Store the mapping of user.id to socket.id
        userSocketMap.set(userId, socket.id);

        rooms.set(roomId, room);
        io.to(roomId).emit("room_update", {room, roomId});
        socket.emit("join_room_success", {user, room});
    });

    socket.on("vote_start", (data: { roomId: string }) => {
        const {roomId} = data;
        const room = rooms.get(roomId);
        room?.users.forEach((user) => {
            user.haveVote = false;
            user.numVote = 0;
        });
        if (room) {
            rooms.set(roomId, room);
        }
        io.to(roomId).emit("vote_started", {roomId});
    });

    socket.on("vote_to", (data: {
        roomId: string,
        userId: string,
        voteFromId: string,
        candidateUser: User[],
        oprateUser: User[]
    }) => {
        const {roomId, userId, voteFromId, candidateUser, oprateUser} = data;
        const room = rooms.get(roomId);
        let isOprateUser = oprateUser.some((user) => user.id === voteFromId);
        if (!isOprateUser) {
            socket.emit("error", {message: "你不是操作者"});
            return;
        }
        let isCandidateUser = candidateUser.some((user) => user.id === userId);
        if (!isCandidateUser) {
            socket.emit("error", {message: "不在被投票者里"});
            return;
        }
        candidateUser.forEach((user) => {
            if (user.id === userId) {
                user.numVote = (user.numVote || 0) + 1;
                room?.users.forEach((roomUser) => {
                    if (roomUser.id === userId) {
                        roomUser.numVote = (roomUser.numVote || 0) + 1;
                    }
                });
                if (room) {
                    rooms.set(roomId, room);
                }
            }
        });
        oprateUser.forEach((user) => {
            if (user.id === voteFromId) {
                user.haveVote = true;
            }
            room?.users.forEach((roomUser) => {
                if (roomUser.id === voteFromId) {
                    roomUser.haveVote = true;
                }
            });
            if (room) {
                rooms.set(roomId, room);
            }
        });
        let voters = oprateUser.filter((user) => room?.users.some((roomUser) => roomUser.id === user.id && roomUser.haveVote)).length;
        if (voters === oprateUser.length) {
            let maxVote = Math.max(...room!.users.map((user) => user.numVote || 0));
            let maxVoteUser = room!.users.filter((user) => user.numVote === maxVote);
            if (maxVoteUser.length === 1) {
                room!.users.forEach((user) => {
                    if (user.id === maxVoteUser[0].id) {
                        user.isDead = true;
                    }
                });
                maxVoteUser[0].isDead = true;
            }
            let aliveUser = room!.users.filter((user) => !user.isDead);
            if (room) {
                rooms.set(roomId, room);
            }
            let undercoverCount = aliveUser.filter((user) => user.role === "卧底").length;
            let normalCount = aliveUser.filter((user) => user.role === "普通人" || user.role === "白板").length;
            let message = undercoverCount >= normalCount ? "卧底" : "继续";
            if (undercoverCount === 0) {
                message = "平民";
            }
            io.to(roomId).emit("vote_ended", {roomId, deadUser: maxVoteUser, aliveUser, message});
        }
    });

    socket.on("vote_end", (data: { roomId: string }) => {
        const {roomId} = data;
        const room = rooms.get(roomId);
        let maxVote = Math.max(...room!.users.map((user) => user.numVote || 0));
        let maxVoteUser = room!.users.filter((user) => user.numVote === maxVote && !user.isDead);
        if (maxVoteUser.length === 1) {
            room!.users.forEach((user) => {
                if (user.id === maxVoteUser[0].id) {
                    user.isDead = true;
                }
            });
            maxVoteUser[0].isDead = true;
        }
        let aliveUser = room!.users.filter((user) => !user.isDead);
        if (room) {
            rooms.set(roomId, room);
        }
        let undercoverCount = aliveUser.filter((user) => user.role === "卧底").length;
        let normalCount = aliveUser.filter((user) => user.role === "普通人" || user.role === "白板").length;
        let message = undercoverCount >= normalCount ? "卧底" : "继续";
        if (undercoverCount === 0) {
            message = "平民";
        }
        io.to(roomId).emit("vote_ended", {roomId, deadUser: maxVoteUser, aliveUser, message});
    });

    // 处理聊天消息
    socket.on("chat_message", (data: {
        roomId: string,
        userId: string,
        content: string
    }) => {
        const { roomId, userId, content } = data;
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit("error", { message: "房间不存在" });
            return;
        }

        const user = room.users.find(u => u.id === userId);

        if (!user) {
            socket.emit("error", { message: "用户不存在" });
            return;
        }

        // 创建聊天消息对象
        const chatMessage: ChatMessage = {
            roomId: roomId,
            id: uuidv4(),
            userId: userId,
            userName: user.nickname,
            content: content
        };

        io.to(roomId).emit("chat_message_success", chatMessage);
    });


    socket.on("disconnect", () => {
        // Remove the mapping when the socket disconnects
        userSocketMap.forEach((socketId, userId) => {
            if (socketId === socket.id) {
                userSocketMap.delete(userId);
            }
        });
        console.log("Socket.io connection closed");
    });
});

function broadcastToRoom(roomId: string, data: any) {
    io.to(roomId).emit("message", data);
    // foreach user in roomid emit message

}

console.log("Socket.io server started on port 3060");
