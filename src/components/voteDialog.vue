<template>
  <div id="voteDialog" v-if="isVotable&&!ended&&oprateUser.some(user => user.id === userId)" class="dialog-overlay">
    <div class="dialog">
      <div class="dialog-content">
        <h3>请投票</h3>
        <h4>剩余时间：{{ countdown }}s</h4>
        <!--列表投票-->
        <div class="vote-list">
          <div v-for="user in candidateUser" :key="user.id">
            <el-radio v-model="voteSele" :label="user.id">{{ user.nickname }}</el-radio>
          </div>
        </div>

        <!-- 投票按钮 -->
        <div class="vote-button">
          <button @click="voteTo">投票</button>
        </div>
      </div>
    </div>
  </div>
  <div id="voteDialog" v-if="!isVotable&&!ended" class="dialog-overlay">
    <div class="dialog">
      <div class="dialog-content">
        <h3>本轮投票已结束</h3>
        <div v-if="isGetVoteResult&&userId !== deadMan[deadMan.length-1].id" class="vote-result">
          <p>被投出去的人是：<b>{{ deadMan[deadMan.length - 1].nickname }}</b></p>
        </div>
        <div v-if="isGetVoteResult&&userId === deadMan[deadMan.length-1].id" class="vote-result">
          <p>你被投出去啦，哈哈</p>
        </div>
        <div v-if="!isGetVoteResult" class="vote-result">
<!--          列出平票所有人-->
          <p>本轮：</p>
          <div v-for="user in preToDeadMan" :key="user.id">
            <p>{{ user.nickname }}</p>
          </div>
          <p>平票，重新投票</p>
        </div>

        <div class="vote-button">
          <button @click="closeVoteDialog">确认</button>
        </div>
      </div>
    </div>
  </div>
  <div id="voteDialog" v-if="ended" class="dialog-overlay">
    <div class="dialog">
      <div class="dialog-content">
        <h3>游戏结束</h3>
        <div class="vote-result">
          <p>恭喜{{ winner }}取得胜利！！</p>
          <p>卧底词语为：{{ wordOfUndercover }}</p>
        </div>

        <div class="vote-button">
          <button @click="closeVoteDialog">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {onMounted, ref} from 'vue';
import {MessagePlugin} from "tdesign-vue-next";

const props = defineProps({
  userId: {
    type: String,
    required: true
  },
  isVotable: {
    type: Boolean,
    required: true
  },
  users: {
    type: Array,
    required: true
  },
  aliveUsers: {
    type: Array,
    required: true
  },
  deadMan: {
    type: Array,
    required: true
  },
  preToDeadMan: {
    type: Array,
    required: true
  },
  isGetVoteResult: {
    type: Boolean,
    required: true
  },
  candidateUser: {
    type: Array,
    required: true
  },
  oprateUser: {
    type: Array,
    required: true
  },
  ended: {
    type: Boolean,
    required: true
  },
  winner: {
    type: String,
    required: true
  },
  countdown: {
    type: Number,
    required: true
  }

});

const emit = defineEmits(['voteTo', 'closeVoteDialog']);
const voteSele = ref("");
const wordOfUndercover = ref("");
onMounted(() => {
  for (let i = 0; i < props.users.length; i++) {
    if (props.users[i].role === "卧底") {
      wordOfUndercover.value = props.users[i].word;
      break;
    }
  }
});
function voteTo() {
  if (voteSele.value === "") {
    MessagePlugin.warning("请选择投票对象");
    return;
  }
  // 触发父组件的方法
  emit('voteTo', voteSele.value);
  voteSele.value = "";

}

function closeVoteDialog() {
  emit('closeVoteDialog');
}
</script>

<style scoped>
:root {
  --primary-color: #4473a6;
}
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000; /* 确保对话框在最上层 */
}

.dialog {
  background: white;
  padding: 40px;
  border-radius: 15px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
  width: 60%;
  max-width: 400px;
  text-align: center;
  animation: fadeIn 0.6s ease-out;
}

.dialog-content {
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

.dialog-content h3 {
  color: var(--primary-color);
  margin-bottom: 10px;
  font-size: 1.5em;
  font-weight: 500;
}
.dialog-content h4 {
  color: var(--primary-color);
  margin-bottom: 10px;
  font-size: 1.2em;
  font-weight: 500;
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

.vote-result {
  margin: 20px 0;
}

.vote-result p {
  font-size: 1.1em;
  margin-bottom: 5px;
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

/* 响应式调整 */
@media (max-width: 480px) {
  .dialog {
    padding: 30px 20px;
    width: 70%;
  }

  .dialog-content h2 {
    font-size: 1.8em;
  }

  .dialog-content input[type="text"], .dialog-content button {
    padding: 10px 15px;
    font-size: 14px;
  }
}
</style>
