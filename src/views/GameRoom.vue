<template>
    <nickname-dialog v-if="nicknameDialogVisible" @nickname-submitted="handleNicknameSubmitted"/>
    <div class="room-container"
         @touchstart="handleTouchStart"
         @touchmove="handleTouchMove"
         @touchend="handleTouchEnd">
      <!-- 固定顶部栏 -->
      <div class="top-bar">
        <div>房间号：<span class="room-id">{{ roomId }}</span></div>
      </div>


      <!-- 玩家列表 -->
      <div class="player-list" :key="randKey">
        <div v-for="(user,index) in users" :key="user.id" :id="user.id"
             :class="{userDead: user.isDead, self: user.id === userid&&!user.isDead, common: user.id!== userid&&!user.isDead}">

          <el-avatar :id="'avatar'+user.id" :size="35" :class="{alive:!user.isDead , dead: user.isDead}">
            {{ user.nickname.slice(0, 1) }}
          </el-avatar>
          <span v-if="user.id === hostId" class="host-label">(房主)</span>
          <span class="order-label">{{index+1}}</span>

          <span class="user-nickname">{{ user.nickname }}</span>
        </div>
      </div>

      <!--游戏内容框-->
      <div class="game-container">
        <div class="game-title" v-if="!started">等待房主开始游戏</div>
        <div class="game-info" v-if="started">
          <div class="game-title" v-if="!isVotable">游戏进行中</div>
          <div class="game-title" v-if="isVotable">投票进行中, 请等待其他玩家投票<b>({{ countdown }} 秒)</b></div>
          <div class="game-word">{{ word }}</div>
        </div>
        <!-- 下滑提示器 -->
        <div class="swipe-indicator" @click="showChat = !showChat">
          <i class="arrow-down"></i>
          <span>下滑查看聊天</span>
        </div>
      </div>

      <!-- 聊天框 -->
      <div class="chat-container" :class="{ 'slide-up': showChat }">
        <!-- 聊天消息列表 -->
        <div class="chat-messages" ref="messageListRef">
          <div v-for="msg in chatMessages" :key="msg.id" class="message-item">
            <div class="message-avatar">
              <el-avatar :size="30" class="alive">
                {{ msg.userName.slice(0, 1) }}
              </el-avatar>
            </div>
            <div class="message-content">
              <div :class="{messageName:msg.userId!==userid,messageNameSelf: msg.userId===userid}">{{ msg.userName }}</div>
              <div :class="{messageText:msg.userId!==userid,messageTextSelf: msg.userId===userid}">{{ msg.content }}</div>
            </div>
          </div>
        </div>

        <!-- 输入框区域 -->
        <div class="chat-input-area">
          <div class="input-wrapper">
            <input
                v-model="messageText"
                type="text"
                placeholder="输入消息..."
                class="chat-input"
                :maxlength="100"
                @keyup.enter="sendMessage"
            >
            <button class="chat-send-btn" @click="sendMessage">
              发送
            </button>
          </div>
        </div>
      </div>


      <!-- 投票选择框-->
      <vote-dialog v-if="voteDialogVisible" :user-id="userid" :is-votable="isVotable" :dead-man="deadMan" :users="users"
                   :alive-users="aliveUsers" :pre-to-dead-man="preToDeadMan"
                   :is-get-vote-result="isGetVoteResult" :candidate-user="candidateUser" :oprate-user="oprateUser"
                   :ended="ended" :winner="winner" :countdown="countdown"
                   @vote-to="voteTo" @close-vote-dialog="closeVoteDialog"/>

      <!-- 底部操作栏 -->
      <div class="bottom-bar">
        <button v-if="isHost&&started&&!isVotable" :key="randKey" class="start-vote-button"
                @click="openVoteConfirmDialog">
          开始投票
        </button>
        <button v-if="isHost&&!started" class="start-game-button" @click="openReStartConfirmDialog">
          开始游戏
        </button>
        <button v-if="isHost&&started" class="start-game-button" @click="openReStartConfirmDialog">
          重新开始
        </button>
        <button class="exit-room-button" @click="openExitConfirmDialog">
          退出房间
        </button>
      </div>


      <t-dialog
          width="90%"
          :closeBtn="false"
          closeOnOverlayClick
          destroyOnClose
          header="确认开始本轮投票吗？"
          placement="center"
          v-model:visible="isShowVoteConfirmDialog"
          dialog-class-name="confirm-dialog"
      >
        <template #footer>
          <div style="display: flex;gap: 20px;justify-content: center">
            <button @click="startVote">确认</button>
            <button style="background-color: rgba(0,0,0,0.22)" @click="isShowVoteConfirmDialog = false">取消</button>
          </div>
        </template>
      </t-dialog>
      <t-dialog
          width="90%"
          :closeBtn="false"
          closeOnOverlayClick
          destroyOnClose
          :header="(started?'确定重新开始游戏吗？':'确定开始游戏吗？')"
          placement="center"
          v-model:visible="isShowReStartConfirmDialog"
          dialog-class-name="confirm-dialog"
      >
        <template #body>
          <t-checkbox v-model="isOpenBlank">开启白板</t-checkbox>
        </template>
        <template #footer>
          <div style="display: flex;gap: 20px;justify-content: center">
            <button @click="startGame">确认</button>
            <button style="background-color: rgba(0,0,0,0.22)" @click="isShowReStartConfirmDialog = false">取消</button>
          </div>
        </template>
      </t-dialog>
      <t-dialog
          :closeBtn="false"
          closeOnOverlayClick
          destroyOnClose
          attach="footer"
          header="确认退出房间吗？"
          placement="center"
          v-model:visible="isShowExitConfirmDialog"
          dialog-class-name="confirm-dialog"
      >
        <template #footer>
          <div style="display: flex;gap: 20px;justify-content: center">
            <button @click="exitRoom">确认</button>
            <button style="background-color: rgba(0,0,0,0.22)" @click="isShowExitConfirmDialog = false">取消</button>
          </div>
        </template>
      </t-dialog>
    </div>


</template>
<script setup>
import {ref, onMounted, watch , nextTick} from "vue";
import {useRoute, useRouter} from "vue-router";
import SocketIOClient from "../utils/socketio.js";
import Cookies from 'js-cookie';

import NicknameDialog from '../components/nicknameDialog.vue';
import {MessagePlugin,} from "tdesign-vue-next";
import VoteDialog from "../components/voteDialog.vue";

const route = useRoute();
const router = useRouter();
const socketClient = new SocketIOClient(import.meta.env.VITE_WS_URL + ":3060"); // 使用环境变量

// 获取传递的房间号
const roomId = route.params.roomId;
// 房间内玩家列表
const users = ref([]);
const randKey = ref("");

// 弹窗, 用于输入昵称
const nicknameDialogVisible = ref(false);
const nickname = ref("");
const userid = ref("");

const hostId = ref("");
const isHost = ref(false);
const isJoin = ref(false);

const rid = Cookies.get("roomid");
const uid = Cookies.get("userid");
// 投票计时
const countdown = ref(15);

const started = ref(false);
const ended = ref(false);
const winner = ref("");
const word = ref("");

const userNames = ref([]);
const deadMan = ref([]);
const aliveUsers = ref([]);
const preToDeadMan = ref([]);
const isGetVoteResult = ref(true);
const isVotable = ref(false);
const voteDialogVisible = ref(false);

// 聊天相关
const showChat = ref(false);
const chatMessages = ref([]);
const messageText = ref("");
const touchStartY = ref(0);
const messageListRef = ref(null);

// 可投票玩家和候选投票玩家
const oprateUser = ref([]);
const candidateUser = ref([]);


watch([users, randKey, nicknameDialogVisible, nickname, userid, hostId, isHost, isJoin, started, ended, winner, word, userNames, deadMan, aliveUsers, preToDeadMan, isGetVoteResult, isVotable, voteDialogVisible, oprateUser, candidateUser,chatMessages],
    ([newUsers, newRandKey, newDialogVisible, newNickname, newUserid, newHostId, newIsHost, newIsJoin, newStarted, newEnded, newWinner, newWord, newUserNames, newDeadMan, newAliveUsers, newPreToDeadMan, newIsGetVoteResult, newIsVotable, newVoteDialogVisible, newOprateUser, newCandidateUser, newChatMessages]) => {
      Cookies.set('users', JSON.stringify(newUsers));
      Cookies.set('randKey', newRandKey);
      Cookies.set('nicknameDialogVisible', newDialogVisible);
      Cookies.set('nickname', newNickname);
      Cookies.set('userid', newUserid);
      Cookies.set('hostId', newHostId);
      Cookies.set('isHost', newIsHost);
      Cookies.set('isJoin', newIsJoin);
      Cookies.set('started', newStarted);
      Cookies.set('ended', newEnded);
      Cookies.set('winner', newWinner);
      Cookies.set('word', newWord);
      Cookies.set('userNames', JSON.stringify(newUserNames));
      Cookies.set('deadMan', JSON.stringify(newDeadMan));
      Cookies.set('aliveUsers', JSON.stringify(newAliveUsers));
      Cookies.set('preToDeadMan', JSON.stringify(newPreToDeadMan));
      Cookies.set('isGetVoteResult', newIsGetVoteResult);
      Cookies.set('isVotable', newIsVotable);
      Cookies.set('voteDialogVisible', newVoteDialogVisible);
      Cookies.set('oprateUser', JSON.stringify(newOprateUser));
      Cookies.set('candidateUser', JSON.stringify(newCandidateUser));
      Cookies.set('chatMessages', JSON.stringify(newChatMessages));
    }, {deep: true});

// 初始化
onMounted(async () => {
  if (!socketClient.isConnected) {
    await socketClient.connect();
  }

  init();

  // 监听服务器消息
  // 房间更新
  socketClient.onMessage("room_update", (message) => {
    console.log("room_update", message.room);
    if (message.roomId !== roomId) {
      return;
    }

    users.value = message.room.users;
    hostId.value = message.room.host;
    isHost.value = message.room.host === userid.value;

  });

  // 加入房间成功
  socketClient.onMessage("join_room_success", (message) => {
    Cookies.set("userid", message.user.id);
    Cookies.set("roomid", roomId);
    Cookies.set("nickname", message.user.nickname);

    users.value = message.room.users;

    for (const user of message.room.users) {
      if (user.nickname === nickname.value) {
        // 获取用户自身id
        userid.value = user.id;
      }
    }

    isJoin.value = true;
    hostId.value = message.room.host;
    isHost.value = message.room.host === userid.value;
  });

  // 房间信息
  socketClient.onMessage("room_info", (message) => {
    console.log("room_info", message.room);
    users.value = message.room.users;

    // 曾经来过
    if (uid !== undefined && uid !== "undefined") {
      for (const user of message.room.users) {
        if (user.id === uid) {
          nickname.value = user.nickname;
          userid.value = user.id;
          word.value = user.word;
        }
      }
      isJoin.value = true;
      isHost.value = message.room.host === userid.value;

      // 恢复数据
      users.value = JSON.parse(Cookies.get('users') || '[]');
      randKey.value = Cookies.get('randKey') || '';
      nicknameDialogVisible.value = Cookies.get('nicknameDialogVisible') === 'true';
      nickname.value = Cookies.get('nickname') || '';
      userid.value = Cookies.get('userid') || '';
      hostId.value = Cookies.get('hostId') || '';
      isHost.value = Cookies.get('isHost') === 'true';
      isJoin.value = Cookies.get('isJoin') === 'true';
      started.value = Cookies.get('started') === 'true';
      ended.value = Cookies.get('ended') === 'true';
      winner.value = Cookies.get('winner') || '';
      userNames.value = JSON.parse(Cookies.get('userNames') || '[]');
      deadMan.value = JSON.parse(Cookies.get('deadMan') || '[]');
      aliveUsers.value = JSON.parse(Cookies.get('aliveUsers') || '[]');
      preToDeadMan.value = JSON.parse(Cookies.get('preToDeadMan') || '[]');
      isGetVoteResult.value = Cookies.get('isGetVoteResult') === 'true';
      isVotable.value = Cookies.get('isVotable') === 'true';
      voteDialogVisible.value = Cookies.get('voteDialogVisible') === 'true';
      oprateUser.value = JSON.parse(Cookies.get('oprateUser') || '[]');
      candidateUser.value = JSON.parse(Cookies.get('candidateUser') || '[]');
      chatMessages.value = JSON.parse(Cookies.get('chatMessages') || '[]');
    } else {
      // 第一次进来
      nicknameDialogVisible.value = true;
      voteDialogVisible.value = false;
      userNames.value = [];

      for (const user of message.room.users) {
        if (user.id !== userid.value) {
          userNames.value.push(user.nickname);
        }
      }
    }

    hostId.value = message.room.host;
  });

  // 游戏开始
  socketClient.onMessage("game_started", (message) => {
    console.log("游戏开始啦");

    if (!isJoin || message.roomId !== roomId) {
      return;
    }
    MessagePlugin.success("游戏开始啦");
    clearTimeout(countdownInterval2);

    users.value = message.users;
    aliveUsers.value = message.users;
    candidateUser.value = message.users;
    oprateUser.value = message.users;

    for (const user of message.users) {
      if (user.id === userid.value) {
        word.value = user.word;
      }
    }
    started.value = true;
    // 刷新字段
    ended.value = false;
    isVotable.value = false;
    voteDialogVisible.value = false;
    isGetVoteResult.value = true;
    preToDeadMan.value = [];
    deadMan.value = [];

    console.log("word", started.value, word.value);
  });

  // 投票开始
  socketClient.onMessage("vote_started", (message) => {
    console.log("开始投票");

    if (!isJoin || message.roomId !== roomId) {
      return;
    }
    MessagePlugin.success("投票开始啦");

    isVotable.value = true;
    voteDialogVisible.value = true;
    //倒计时
    startCountdown();
  });

  // 投票结束
  socketClient.onMessage("vote_ended", (message) => {
    if (!isJoin || message.roomId !== roomId) {
      return;
    }
    clearTimeout(countdownInterval2);
    if (message.message === "卧底" || message.message === "平民") {
      winner.value = message.message;
      voteDialogVisible.value = true;
      ended.value = true;
      return;
    }

    isVotable.value = false;
    voteDialogVisible.value = true;
    console.log("投票结束" + voteDialogVisible.value);
    MessagePlugin.info("投票结束");

    if (message.deadUser.length === 1) {
      for (const user of users.value) {
        if (user.id.toString() === message.deadUser[0].id) {
          user.isDead = true;
        }
      }

      deadMan.value.push(message.deadUser[0]);
      aliveUsers.value = message.aliveUser;
      candidateUser.value = message.aliveUser;
      oprateUser.value = message.aliveUser;
      isGetVoteResult.value = true;
      console.log(deadMan.value, aliveUsers.value, candidateUser.value, oprateUser.value, isGetVoteResult.value);
    } else if (message.deadUser.length === message.aliveUser.length) {
      aliveUsers.value = message.aliveUser;
      candidateUser.value = message.aliveUser;
      oprateUser.value = message.aliveUser;
      preToDeadMan.value = candidateUser.value;
      isGetVoteResult.value = false;
    } else {
      aliveUsers.value = message.aliveUser;
      candidateUser.value = message.deadUser;
      oprateUser.value = message.aliveUser.filter(aliveUser =>
          !candidateUser.value.some(candidate => candidate.id === aliveUser.id)
      );
      preToDeadMan.value = candidateUser.value;
      isGetVoteResult.value = false;
    }
  });

  // 聊天消息
  socketClient.onMessage("chat_message_success", (message) => {
    console.log("chat_message_success", message);
    if (!isJoin || message.roomId !== roomId) {
      return;
    }
    handleNewMessage(message);
  });

  // 监听错误
  socketClient.onMessage("error", (message) => {
    alert(message.message);
  });

});

// 在页面关闭时
window.onbeforeunload = function () {
  socketClient.disconnect();
};

function init() {
  try {
    if (rid !== undefined && rid !== "undefined") {
      if (rid !== roomId) {
        MessagePlugin.error("你怎么进来的");
        router.push('/');
      }
    }
    socketClient.send("get_room_info", {roomId: roomId, userId: uid});
  } catch (error) {
    console.error(error);
  }
}

// 提交昵称及请求加入房间
function handleNicknameSubmitted(nn) {
  try {
    console.log("userNames", userNames.value);
    for (const niName of userNames.value) {
      if (niName === nn) {
        MessagePlugin.error("昵称已被占用");
        return;
      }
    }

    socketClient.send("join_room", {roomId: roomId, nickname: nn});

    nickname.value = nn;
    nicknameDialogVisible.value = false;
    randKey.value = Math.random().toString(36).substring(2, 15);
  } catch (error) {
    MessagePlugin.error("加入房间失败，请重试");
  }
}

// 开始游戏请求
function startGame() {
  socketClient.send("start_game", {roomId: roomId, isOpenBlank: isOpenBlank.value});
  isShowReStartConfirmDialog.value = false;
}

// 投票开始请求
function startVote() {
  socketClient.send("vote_start", {roomId: roomId});

  isShowVoteConfirmDialog.value = false;
  let ctd = 15;
  countdownInterval2 = setTimeout(() => {
    socketClient.send("vote_end", {roomId: roomId});
  }, ctd * 1000);
}

// 倒计时
let countdownInterval2 = null;

function startCountdown() {
  countdown.value = 15;
  let countdownInterval1 = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--;
    } else {
      clearInterval(countdownInterval1);
    }
  }, 1000); // Decrease countdown every second
}

// 投票请求
function voteTo(voteSele) {
  try {
    socketClient.send("vote_to", {
      roomId: roomId,
      userId: voteSele,
      voteFromId: userid.value,
      oprateUser: oprateUser.value,
      candidateUser: candidateUser.value,
    });
    MessagePlugin.success("投票成功");
    voteDialogVisible.value = false;
  } catch (error) {
    MessagePlugin.error("投票失败，请重试");
  }
}

function closeVoteDialog() {
  voteDialogVisible.value = false;
}

// 退出房间请求
function exitRoom() {
  if (Cookies.get("userid") === userid.value) {
    socketClient.send("exit_room", {
      roomId: roomId,
      userId: userid.value
    });
    Cookies.set("userid", undefined);
    Cookies.set("roomid", undefined);
    socketClient.disconnect();
    router.push('/'); // 返回到加入房间页面
    return;
  }
  socketClient.disconnect();
  router.push('/'); // 返回到加入房间页面
}

// 手势控制方法
function handleTouchStart(e) {
  touchStartY.value = e.touches[0].clientY;
}

function handleTouchMove(e) {
  const touchEndY = e.touches[0].clientY;
  if (touchEndY - touchStartY.value > 160) {
    showChat.value = true;
  } else if (touchEndY - touchStartY.value < -160) {
    showChat.value = false;
  }
}

function handleTouchEnd() {
  touchStartY.value = 0;
}

// 发送消息
function sendMessage() {
  if (messageText.value === "") {
    return;
  }
  socketClient.send("chat_message", {
    roomId: roomId,
    userId: userid.value,
    content: messageText.value,
  });
  console.log("发送消息", messageText.value);
  messageText.value = "";
}

// 处理新消息
function handleNewMessage(message) {
  chatMessages.value.push(message);
  console.log("消息栏", chatMessages.value);
  setTimeout(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  }, 0)

}


// 投票开始确认
const isShowVoteConfirmDialog = ref(false);
// 重新开始确认
const isShowReStartConfirmDialog = ref(false);
// 退出房间确认
const isShowExitConfirmDialog = ref(false);
// 是否加入白板
const isOpenBlank = ref(false);
function openVoteConfirmDialog() {
  isShowVoteConfirmDialog.value = true;
}

function openReStartConfirmDialog() {
  isShowReStartConfirmDialog.value = true;
}

function openExitConfirmDialog() {
  isShowExitConfirmDialog.value = true;
}
</script>
<style>
:root {
  --primary-color: #4473a6;
}

.room-container {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(to bottom, #e6f3ff, #ffffff);
}

.top-bar {
  height: 60px;
  background-color: #4473a6;
  color: white;
  padding: 0 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.room-id {
  font-weight: bold;
  font-size: 1.2em;
  margin-left: 5px;
}

.player-list {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.player-list > div {
  position: relative;
  background: white;
  padding: 15px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;
}

.player-list > div:hover {
  transform: translateY(-4px);
}

.player-list .self {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
}

.player-list .userDead {
  background: #d7dcde;
  border: 1px solid #8c8585;
  opacity: 0.7;
}

.alive {
  background: var(--primary-color);
  color: white;
  width: 35px;
  height: 35px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-weight: bold;
}

.dead {
  background: #454b59;
  color: white;
  width: 35px;
  height: 35px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-weight: bold;
}

.user-nickname {
  flex: 1;
  font-size: 12px;
  color: #333;
}

.host-label {
  position: absolute;
  bottom: 0;
  left: 15px;
  font-size: 12px;
  color: #ff1833;
}
.order-label{
  position: absolute;
  bottom: 3px;
  right: 6px;
  font-weight: 700;
  font-size: 12px;
  color: var(--primary-color);
}

.container {
  position: absolute;

  height: 50vh;
  overflow: hidden;
}

.chat-container {
  position: absolute;
  top: -55%;
  left: 0;
  right: 0;
  height: 55%;
  background: rgba(154, 205, 246, 0.92);
  border-radius: 15px 15px 0 0;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease-out;
  display: flex;
  flex-direction: column;
}

.chat-container.slide-up {
  transform: translateY(100%);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f9feff;
  justify-items: center;
}

.message-item {
  display: flex;
  width: 80%;
  margin-bottom: 16px;
  animation: fadeIn 0.3s ease-out;
}

.message-avatar {
  margin-right: 12px;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
}

.messageName {
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
}
.messageNameSelf{
  font-size: 14px;
  color: var(--primary-color);
  margin-bottom: 4px;
}

.messageText {
  background: white;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 100%;
  word-break: break-word;
  box-shadow: 0px 1px 2px 0px #326398a1;
}

.messageTextSelf {
  border: 1px solid var(--primary-color);
  background: white;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 100%;
  word-break: break-word;
  box-shadow: 0px 1px 2px 0px #326398a1;
}

.chat-input-area {
  padding: 12px;
  border-top: 1px solid #eee;
  background: white;
}

.input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
}

.chat-input {
  flex: 4;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #dcdcdc;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-send-btn{
  flex: 1;
}

.chat-input:focus {
  border-color: var(--td-brand-color);
}

.chat-input::placeholder {
  color: #999;
}

.swipe-indicator {
  cursor: pointer;
  position: absolute;
  top: 50%;
  text-align: center;
  color: var(--primary-color);
  font-size: 12px;
  opacity: 0.7;
}

.arrow-down {
  display: block;
  width: 10px;
  height: 10px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  margin: 0 auto 5px;
  animation: bounce 1s infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0) rotate(45deg);
  }
  40% {
    transform: translateY(-5px) rotate(45deg);
  }
  60% {
    transform: translateY(-3px) rotate(45deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 4px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--primary-color);
  border-radius: 3px;
}

/* 响应式调整 */
@media (max-width: 600px) {
  .message-item {
    width: 100%;
  }

  .chat-input-area {
    padding: 8px;
  }
}

.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  margin: 20px;
  padding: 20px;
  background: white;
  border-radius: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.game-title {
  font-size: 24px;
  color: var(--primary-color);
  margin-bottom: 30px;
  font-weight: 600;
  text-align: center;
  animation: slideDown 0.6s ease-out;
}

.game-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: fadeIn 0.8s ease-out;
}

.game-word {
  font-size: 36px;
  font-weight: bold;
  color: #333;
  padding: 30px 50px;
  background: #f0f7ff;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(24, 144, 255, 0.1);
  margin-top: 20px;
  animation: scaleIn 0.5s ease-out;
  transition: transform 0.3s;
}

.game-word:hover {
  transform: scale(1.05);
}

/* 动画定义 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideDown {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* 游戏开始时的过渡动画 */
.game-info-enter-active {
  animation: slideIn 0.6s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 响应式调整 */
@media (max-width: 600px) {
  .game-title {
    font-size: 20px;
    margin-bottom: 20px;
  }

  .game-word {
    font-size: 28px;
    padding: 20px 30px;
  }
}


.bottom-bar {
  height: 70px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

button {
  padding: 10px 25px;
  border-radius: 5px;
  border: none;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s;
  max-width: 35%;
}

.start-game-button, .start-vote-button, .exit-room-button {
  height: 80%;
}

.start-vote-button {
  background: #ff1833;
  color: white;
}

.start-vote-button:hover {
  background: #ee3e53;
}

.start-game-button {
  background: var(--primary-color);
  color: white;
}

.start-game-button:hover {
  background: #40a9ff;
}

.exit-room-button {
  background: #f5f5f5;
  color: #333;
}

.exit-room-button:hover {
  background: #e6e6e6;
}

/* 响应式调整 */
@media (max-width: 600px) {
  .player-list {
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;
    padding: 10px;
  }

  .player-list .common {
    height: 70px;
  }

  .player-list .self {
    height: 70px;
  }

  .bottom-bar {
    height: 65px;
    padding: 0 10px;
  }

  button {
    padding: 8px 15px;
  }
}

.vote-container {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateY(-50%);
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  width: 220px;
  animation: slideIn 0.4s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
}

.vote-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 15px;
  padding-right: 10px;
}

.vote-list::-webkit-scrollbar {
  width: 6px;
}

.vote-list::-webkit-scrollbar-track {
  background: #f0f0f0;
  border-radius: 3px;
}

.vote-list::-webkit-scrollbar-thumb {
  background: var(--primary-color);
  border-radius: 3px;
}

.vote-list > div {
  margin-bottom: 12px;
  transition: transform 0.2s;
}

.vote-list > div:hover {
  transform: translateX(5px);
}


.vote-button {
  text-align: center;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
}

.vote-button button {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 10px 30px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  width: 100%;
}

.vote-button button:hover {
  background: #40a9ff;
  transform: translateY(-1px);
}

.vote-button button:active {
  transform: translateY(1px);
}

.confirm-dialog {
  width: 90%;
  max-width: 500px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .vote-container {
    position: fixed;
    left: 50%;
    bottom: 80px;
    top: auto;
    transform: translateX(-50%);
    width: 90%;
    max-width: 220px;
    animation: slideUp 0.4s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

}
</style>


