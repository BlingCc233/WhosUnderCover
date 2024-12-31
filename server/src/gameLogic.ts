import axios from "axios";
import {User} from "./types";

/**
 * 获取词语对（word1 和 word2）
 */
export const fetchWords = async (): Promise<{ word1: string; word2: string }> => {
    const response = await axios.get("https://sdk.blingcc.eu.org/api/sswd");
    return response.data.data;
};

/**
 * 分配身份与词语
 * @param users 当前房间用户列表
 * @param words 词语对
 */
export const assignRolesAndWords = (users: User[], words: { word1: string; word2: string },isOpenBlank: boolean) => {
    const totalPlayers = users.length;
    let normalCount = 0, undercoverCount = 0, blankCount = 0;

    // 判断白板是否开启
    blankCount = !isOpenBlank ? 1 : 0;
    // 确定身份比例
    if (totalPlayers === 3) [normalCount, undercoverCount] = [2, 1];
    else if (totalPlayers === 4) [normalCount, undercoverCount] = [2 + blankCount, 1];
    else if (totalPlayers === 5) [normalCount, undercoverCount] = [3 + blankCount, 1];
    else if (totalPlayers === 6) [normalCount, undercoverCount] = [4 + blankCount, 1];
    else if (totalPlayers === 7) [normalCount, undercoverCount] = [4 + blankCount, 2];
    else throw new Error("玩家数量不符合规则");

    // 随机打乱用户数组
    let shuffledUsers = [...users].sort(() => Math.random() - 0.5);

    // 分配身份和词语
    for (let i = 0; i < shuffledUsers.length; i++) {
        if (i < normalCount) {
            shuffledUsers[i].role = "普通人";
            shuffledUsers[i].word = words.word1;
            shuffledUsers[i].isDead = false;
            shuffledUsers[i].haveVote = false;
            shuffledUsers[i].numVote = 0;
        } else if (i < normalCount + undercoverCount) {
            shuffledUsers[i].role = "卧底";
            shuffledUsers[i].word = words.word2;
            shuffledUsers[i].isDead = false;
            shuffledUsers[i].haveVote = false;
            shuffledUsers[i].numVote = 0;
        } else {
            shuffledUsers[i].role = "白板";
            shuffledUsers[i].word = "白板";
            shuffledUsers[i].isDead = false;
            shuffledUsers[i].haveVote = false;
            shuffledUsers[i].numVote = 0;
        }
    }
    shuffledUsers = [...shuffledUsers].sort(() => Math.random() - 0.5);

    return shuffledUsers;
};
