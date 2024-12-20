import {WebSocketServer, WebSocket} from "ws";
import {v4 as uuidv4} from "uuid";
import {assignRolesAndWords, fetchWords} from "./gameLogic";
import {Room, User} from "./types";

const wss = new WebSocketServer({port: 3060});
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


wss.on("connection", (ws: WebSocket) => {
    console.log("WebSocket 连接已建立");

    ws.on("message", async (message: string) => {
        const data: ClientMessage = JSON.parse(message);
        const {type, roomId, nickname, userId, voteFromId,oprateUser, candidateUser} = data;

        // 加入房间逻辑
        if (type === "create_room" && roomId) {
            if (rooms.has(roomId)) {
                ws.send(JSON.stringify({type: "room_exist", message: "房间已存在"}));
                return;
            }
            const room: Room = {roomId, users: [], host: ""};
            rooms.set(roomId, room);

            ws.send(JSON.stringify({type: "room_created", room}));
            // 房间建立后两小时自动销毁
            setTimeout(() => {
                rooms.delete(roomId);
            }, 2 * 60 * 60 * 1000);
        }

        // 开始游戏逻辑
        if (type === "start_game" && roomId) {
            const room = rooms.get(roomId);

            if (room && room.users.length >= 4) {
                try {

                    const words = await fetchWords();
                    const updatedUsers = assignRolesAndWords(room.users, words);
                    room.users = updatedUsers;

                    rooms.set(roomId, room);

                    // 通知房间内所有用户
                    broadcastToRoom(roomId, {type: "game_started", users: updatedUsers, roomId});
                } catch (error) {
                    ws.send(JSON.stringify({type: "error", message: "分配词语失败"}));
                }
            } else {
                ws.send(JSON.stringify({type: "error", message: "人数不足，无法开始游戏"}));
            }
        }

        // 退出房间逻辑
        if (type === "exit_room" && roomId && userId) {
            const room = rooms.get(roomId);
            if (room) {
                room.users = room.users.filter((user) => user.id !== userId);
                if (room.users.length === 0) {
                    rooms.delete(roomId);
                    return;
                }
                room.host = room.users[0]?.id || "";
                rooms.set(roomId!, room);
                broadcastToRoom(roomId, {type: "room_update", room, roomId});
            }
        }

        if (type === "get_room_info" && roomId) {

            const room = rooms.get(roomId);

            ws.send(JSON.stringify({type: "room_info", room}));
        }

        if (type === "join_room" && roomId) {
            const userId = uuidv4();
            const room = rooms.get(roomId);
            const user: User = {id: userId, nickname: nickname || `玩家${userId.slice(0, 4)}`};
            if (room) {
                room.users.push(user);
                if (!room.host) room.host = userId;
            } else {
                ws.send(JSON.stringify({type: "error", message: "房间不存在"}));
                return;
            }

            rooms.set(roomId!, room);
            broadcastToRoom(roomId, {type: "room_update", room, roomId});
            ws.send(JSON.stringify({type: "join_room_success", user, room}));
        }

        if (type === "vote_start" && roomId) {
            const room = rooms.get(roomId);
            room?.users.forEach((user) => {
                user.haveVote = false;
                user.numVote = 0;
            });
            if (room) {
                rooms.set(roomId, room);
            }
            broadcastToRoom(roomId, {type: "vote_started", roomId})
        }

        if (type === "vote_to" && roomId && userId && voteFromId && candidateUser && oprateUser) {
            const room = rooms.get(roomId);
            // 如果voteFromId不在oprateUser里，返回错误
            let isOprateUser = false;
            oprateUser.forEach((user) => {
                if (user.id === voteFromId) {
                    isOprateUser = true;
                }
            });
            if (!isOprateUser) {
                ws.send(JSON.stringify({type: "error", message: "你不是操作者"}));
                return;
            }
            // 如果userId不在candidateUser里，返回错误
            let isCandidateUser = false;
            candidateUser.forEach((user) => {
                if (user.id === userId) {
                    isCandidateUser = true;
                }
            });
            if (!isCandidateUser) {
                ws.send(JSON.stringify({type: "error", message: "不在被投票者里"}));
                return;
            }
            // 在candidateUser里找到userId，对应的numVote加1
            candidateUser.forEach((user) => {
                if (user.id === userId) {
                    user.numVote = (user.numVote || 0) + 1;
                    // 对应room.users里的numVote也加1
                    room?.users.forEach((roomUser) => {
                        if (roomUser.id === userId) {
                            roomUser.numVote = (roomUser.numVote || 0) + 1;
                        }
                    });
                    if(room) {
                        rooms.set(roomId!, room);
                    }
                }
            });
            // 将对应的voteFromId的haveVote设为true
            oprateUser.forEach((user) => {
                if (user.id === voteFromId) {
                    user.haveVote = true;
                }
                // 对应room.users里的haveVote也设为true
                room?.users.forEach((roomUser) => {
                    if (roomUser.id === voteFromId) {
                        roomUser.haveVote = true;
                    }
                });
                if (room) {
                    rooms.set(roomId!, room);
                }
            });
            // 如果所有haveVote都为true，广播投票结束
            let voters = 0;
            oprateUser.forEach((user) => {
                room?.users.forEach((roomUser) => {
                    if (roomUser.id === user.id && roomUser.haveVote) {
                        voters++;
                    }
                });
            });
            if (voters === oprateUser.length) {
                // 找出numVote最大的人，如果不唯一，则返回一个列表
                let maxVote = 0;
                let maxVoteUser: User[] = [];
                room?.users.forEach((user) => {
                    if (user.numVote! > maxVote) {
                        maxVote = user.numVote!;
                    }
                });
                room?.users.forEach((user) => {
                    if (user.numVote === maxVote) {
                        maxVoteUser.push(user);
                    }
                });
                if(maxVoteUser.length === 1){
                    // room.users里对应的人的isDead设为true
                    room?.users.forEach((user) => {
                        if (user.id === maxVoteUser[0].id) {
                            user.isDead = true;
                        }
                    });
                    maxVoteUser[0].isDead = true;
                }
                // 找出活着的人
                let aliveUser: User[] = [];
                room?.users.forEach((user) => {
                    if (!user.isDead) {
                        aliveUser.push(user);
                    }
                });
                if(room){
                    rooms.set(roomId, room);
                }
                // 如果卧底占比达到50%，游戏结束
                let undercoverCount = 0;
                let normalCount = 0;
                aliveUser.forEach((user) => {
                    if (user.role === "卧底") {
                        undercoverCount++;
                    }
                    if (user.role === "普通人" || user.role === "白板") {
                        normalCount++;
                    }
                });
                let message = "";
                if (undercoverCount >= normalCount) {
                    message = "卧底";
                }else {
                    message = "继续";
                }
                // 如果卧底全不在了，游戏结束
                if (undercoverCount === 0) {
                    message = "平民";
                }
                broadcastToRoom(roomId, {type: "vote_ended", roomId, deadUser: maxVoteUser, aliveUser, message});
            }

        }

        if (type === "vote_end" && roomId) {
            const room = rooms.get(roomId);
            let maxVote = 0;
            let maxVoteUser: User[] = [];
            room?.users.forEach((user) => {
                if (user.numVote! > maxVote && !user.isDead) {
                    maxVote = user.numVote!;
                }
            });
            room?.users.forEach((user) => {
                if (user.numVote === maxVote && !user.isDead) {
                    maxVoteUser.push(user);
                }
            });
            if(maxVoteUser.length === 1){
                // room.users里对应的人的isDead设为true
                room?.users.forEach((user) => {
                    if (user.id === maxVoteUser[0].id) {
                        user.isDead = true;
                    }
                });
                maxVoteUser[0].isDead = true;

            }
            // 找出活着的人
            let aliveUser: User[] = [];
            room?.users.forEach((user) => {
                if (!user.isDead) {
                    aliveUser.push(user);
                }
            });
            if(room){
                rooms.set(roomId, room);
            }
            // 如果卧底占比达到50%，游戏结束
            let undercoverCount = 0;
            let normalCount = 0;
            aliveUser.forEach((user) => {
                if (user.role === "卧底") {
                    undercoverCount++;
                }
                if (user.role === "普通人" || user.role === "白板") {
                    normalCount++;
                }
            });
            let message = "";
            if (undercoverCount >= normalCount) {
                message = "卧底";
            }else {
                message = "继续";
            }
            // 如果卧底全不在了，游戏结束
            if (undercoverCount === 0) {
                message = "平民";
            }
            broadcastToRoom(roomId, {type: "vote_ended", roomId, deadUser: maxVoteUser, aliveUser, message});
        }


    });

    ws.on("close", () => console.log("WebSocket 连接已关闭"));
});

/**
 * 广播消息到房间内所有用户
 */
function broadcastToRoom(roomId: string, message: any) {
    wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }

    });
}


console.log("WebSocket 服务已启动，监听端口 3000");
