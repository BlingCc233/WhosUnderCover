<template>
  <div id="nicknameDialog" v-if="dialogVisible" class="dialog-overlay">
    <div class="dialog">
      <div class="dialog-content">
        <h3>设置你的昵称</h3>
        <form @submit.prevent="submitNickname">
          <input type="text" id="nickname" v-model="nicknameForm.nickname"  maxlength="8" placeholder="支持最长8个字符哦" required >
          <button type="submit">确定</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['nickname-submitted']);
const dialogVisible = ref(true);
const nicknameForm = ref({
  nickname: ''
});

function submitNickname(){
  if (nicknameForm.value.nickname.trim()) {
    // 触发父组件的方法
    emit('nickname-submitted', nicknameForm.value.nickname);
    console.log('昵称设置为：', nicknameForm.value.nickname);
  } else {
    alert('请输入昵称');
  }
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
  box-shadow: 0 8px 30px rgba(0,0,0,0.1);
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
  margin-bottom: 15px;
  font-size: 1.5em;
  font-weight: 500;
}

.dialog-content form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.dialog-content input[type="text"] {
  width: 85%;
  padding: 12px 20px;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.3s;
}

.dialog-content input[type="text"]:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(24,144,255,0.1);
}

.dialog-content input[type="text"]::placeholder {
  color: #bbb;
}

.dialog-content button {
  background: var(--primary-color);
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
  width: 85%;
}

.dialog-content button:hover {
  background: #147cd2;
  transform: translateY(-1px);
}

.dialog-content button:active {
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