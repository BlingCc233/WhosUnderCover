<template>
  <div class="home-room">
    <h1>谁是卧底</h1>
    <p>输入房间号创建房间或加入房间</p>
    <!-- 房间号表单 -->
    <div class="home-room-form">
      <input type="text" placeholder="请输入4位数字房间号" required maxlength="6" v-model="roomId">
      <button @click="joinRoom">加入房间</button>
    </div>
  </div>

  <t-link theme="primary" @click="clearCookies" style="margin-top: 20px" underline> 出错误点这里 </t-link>


</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import SocketIOClient from "../utils/socketio.js";
import Cookies from "js-cookie";
import { MessagePlugin } from "tdesign-vue-next";
import exitRoom from "../utils/exitRoom.js";

const router = useRouter();
const socketClient = new SocketIOClient(import.meta.env.VITE_WS_URL + ":3060"); // 使用环境变量

const roomId = ref(""); // 用户输入的房间号

function clearCookies() {
  exitRoom();
  MessagePlugin.success('页面已修复');
}

async function joinRoom() {
  // 检测房间号是否为4位数字
  if (!/^\d{4}$/.test(roomId.value)) {
    await MessagePlugin.warning('请输入合法的房间号');
    return;
  }

  try {
    // 确保 Socket.IO 连接成功
    if (!socketClient.isConnected) {
      await socketClient.connect();
    }

    // 发送加入房间请求
    socketClient.send( "create_room", {
      roomId: roomId.value
    });

    // 监听服务器消息，等待加入成功
    socketClient.onMessage("room_created", (message) => {
      console.log("加入房间成功:", message.room);
      socketClient.disconnect();
      // 跳转到房间页面，并传递房间号
      router.push({
        name: "GameRoom",
        params: { roomId: roomId.value },
      });
    });

    socketClient.onMessage("room_exist", (message) => {
      console.log("房间已存在:", message.room);
      socketClient.disconnect();
      // 跳转到房间页面，并传递房间号
      router.push({
        name: "GameRoom",
        params: { roomId: roomId.value },
      });
    });
  } catch (error) {
    console.error("加入房间失败:", error);
  }
}
</script><style>
:root {
  --primary-color: #4473a6;
}
.home-room {
  background: white;
  padding: 40px;
  border-radius: 15px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
  width: 75%;
  max-width: 400px;
  text-align: center;
  animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

h1 {
  color: var(--primary-color);
  margin-bottom: 15px;
  font-size: 2.2em;
  font-weight: bold;
}

p {
  color: #666;
  margin-bottom: 30px;
  font-size: 1.1em;
}

.home-room-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

input {
  width: 80%;
  padding: 12px 20px;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.3s;
}

input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.1);
}

input::placeholder {
  color: #bbb;
}

button {
  background: var(--primary-color);
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
  width: 80%;
}

button:hover {
  background: #147cd2;
  transform: translateY(-1px);
}

button:active {
  transform: translateY(1px);
}

/* 响应式调整 */
@media (max-width: 480px) {
  .home-room {
    padding: 30px 20px;
    width: 95%;
  }

  h1 {
    font-size: 1.8em;
  }

  p {
    font-size: 1em;
  }

  input, button {
    padding: 10px 15px;
    font-size: 14px;
  }
}


</style>
