// 面试进行页面JavaScript逻辑

// 页面元素
const pauseInterviewBtn = document.getElementById('pauseInterview');
const endInterviewBtn = document.getElementById('endInterview');
const questionDisplay = document.getElementById('questionDisplay');
const answerDisplay = document.getElementById('answerDisplay');

// 音频相关变量
let mediaRecorder; // 不再使用，但保留变量以兼容旧逻辑
let mediaStream;
let webSocket; // WebSocket连接
let sessionId; // 会话ID
let isPaused = false; // 面试暂停状态
let audioCtx; // 音频上下文（16kHz）
let sourceNode; // 媒体源节点
let processorNode; // 处理节点（ScriptProcessor）
let sttReady = false; // 收到后端就绪信号后才发送音频
let recordingStarted = false; // 避免重复启动录音

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 绑定事件
    bindEvents();
    
    // 初始化WebSocket连接
    initWebSocket();
});

// 绑定事件
function bindEvents() {
    // 暂停/恢复面试
    pauseInterviewBtn.addEventListener('click', togglePause);
    
    // 结束面试
    endInterviewBtn.addEventListener('click', endInterview);
}

// 初始化WebSocket连接
function initWebSocket() {
    // 优先使用portal下发的wsUrl与sessionId
    let wsUrl;
    try {
        const raw = localStorage.getItem('interviewSession');
        const sess = raw ? JSON.parse(raw) : null;
        if (sess && sess.wsUrl && sess.sessionId) {
            wsUrl = sess.wsUrl;
            sessionId = sess.sessionId;
        }
    } catch (e) {
        console.warn('interviewSession解析失败，将使用默认连接', e);
    }
    // 兜底生成会话ID与默认地址（本地联调）
    if (!wsUrl) {
        sessionId = 'session_' + Date.now();
        wsUrl = `ws://127.0.0.1:8003/audio/stream?sessionId=${sessionId}`;
    }
    // 创建WebSocket连接
    webSocket = new WebSocket(wsUrl);
    
    // 连接打开事件
    webSocket.onopen = function(event) {
        console.log('WebSocket连接已建立');
    };
    
    // 接收消息事件
    webSocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'stt_ready') {
                // 后端准备就绪，开始录音与音频发送
                sttReady = true;
                if (!recordingStarted) {
                    startRecording();
                }
                return;
            }

            if (data.type === 'stt_partial') {
                // 将实时识别的面试官话语展示为“面试官问题”（临时）
                questionDisplay.innerHTML = `<p style="color:#2c3e50;">${data.content}</p>`;
                return;
            }

            if (data.type === 'stt_final') {
                // 句子结束，用最终识别结果更新“面试官问题”
                questionDisplay.innerHTML = `<p>${data.content}</p>`;
                return;
            }

            if (data.type === 'question') {
                displayQuestion(data.content);
            } else if (data.type === 'answer') {
                if (data.content === '[END]') {
                    // 答案结束标记
                    answerDisplay.innerHTML += '<p style="color: #27ae60;">[回答结束]</p>';
                } else {
                    // 流式显示答案
                    answerDisplay.innerHTML += data.content;
                    // 滚动到最新内容
                    answerDisplay.scrollTop = answerDisplay.scrollHeight;
                }
            }
        } catch (e) {
            console.error('解析WebSocket消息时出错:', e);
        }
    };
    
    // 连接关闭事件
    webSocket.onclose = function(event) {
        console.log('WebSocket连接已关闭');
    };
    
    // 连接错误事件
    webSocket.onerror = function(error) {
        console.error('WebSocket错误:', error);
    };
}

// 开始录音（改为发送 PCM 16kHz/mono/Int16 二进制）
async function startRecording() {
    try {
        // 获取用户媒体权限
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 创建 16kHz 的 AudioContext
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC({ sampleRate: 16000 });

        // 媒体源与处理器节点
        sourceNode = audioCtx.createMediaStreamSource(mediaStream);
        // ScriptProcessorNode：缓冲大小2048，单声道
        processorNode = audioCtx.createScriptProcessor(2048, 1, 1);

        processorNode.onaudioprocess = (event) => {
            // 仅在收到 stt_ready 后开始发送音频
            if (!sttReady || isPaused || !webSocket || webSocket.readyState !== WebSocket.OPEN) return;
            const input = event.inputBuffer.getChannelData(0); // Float32Array [-1,1]
            const inRate = audioCtx.sampleRate || 16000;
            let floatData;
            if (inRate === 16000) {
                floatData = input;
            } else {
                // 简单下采样至16k：抽取法（近似）。如需更高质量可改用低通滤波。
                const ratio = inRate / 16000;
                const outLen = Math.floor(input.length / ratio);
                floatData = new Float32Array(outLen);
                for (let j = 0; j < outLen; j++) {
                    floatData[j] = input[Math.floor(j * ratio)] || 0;
                }
            }
            // Float32 → PCM Int16LE
            const pcm16 = new Int16Array(floatData.length);
            for (let i = 0; i < floatData.length; i++) {
                let s = Math.max(-1, Math.min(1, floatData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            webSocket.send(new Uint8Array(pcm16.buffer));
        };

        // 连接音频图（ScriptProcessor 需连接到 destination 才能触发）
        sourceNode.connect(processorNode);
        processorNode.connect(audioCtx.destination);

        recordingStarted = true;
        console.log('录音（PCM 16kHz）已开始；将于收到 stt_ready 后发送');
    } catch (error) {
        console.error('无法访问麦克风:', error);
        alert('无法访问麦克风，请检查权限设置');
    }
}

// 暂停/恢复面试
function togglePause() {
    isPaused = !isPaused;
    
    if (isPaused) {
        // 暂停：停止发送（保留音频链路）
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.enabled = false);
        }
        pauseInterviewBtn.textContent = '恢复面试';
        console.log('面试已暂停');
    } else {
        // 恢复：重新启用轨道
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.enabled = true);
        }
        pauseInterviewBtn.textContent = '暂停面试';
        console.log('面试已恢复');
    }
}

// 显示问题
function displayQuestion(question) {
    questionDisplay.innerHTML = `<p>${question}</p>`;
}

// 显示回答
function displayAnswer(answer) {
    // 如果是新答案，清空之前的答案
    if (!answerDisplay.innerHTML.includes(answer)) {
        answerDisplay.innerHTML = `<p>${answer}</p>`;
    } else {
        answerDisplay.innerHTML += answer;
    }
    // 滚动到最新内容
    answerDisplay.scrollTop = answerDisplay.scrollHeight;
}

// 结束面试
function endInterview() {
    // 停止音频链路
    try {
        if (processorNode) {
            processorNode.disconnect();
            processorNode.onaudioprocess = null;
        }
        if (sourceNode) sourceNode.disconnect();
        if (audioCtx) audioCtx.close();
        if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
    } catch (e) {
        console.warn('停止音频失败:', e);
    }
    
    // 关闭WebSocket连接
    if (webSocket) {
        webSocket.close();
    }
    
    // 确认是否结束面试
    if (confirm('确定要结束本次面试吗？')) {
        // 清除面试配置
        localStorage.removeItem('interviewConfig');
        
        // 跳转到配置页面
        window.location.href = 'config.html';
    }
}

// 页面卸载前检查
window.addEventListener('beforeunload', function(e) {
    // 如果正在录音，提示用户
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        e.preventDefault();
        e.returnValue = '您正在录音，确定要离开页面吗？';
        return e.returnValue;
    }
});