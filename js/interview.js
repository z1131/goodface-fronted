// 面试进行页面JavaScript逻辑

// 页面元素
const pauseInterviewBtn = document.getElementById('pauseInterview');
const endInterviewBtn = document.getElementById('endInterview');
const questionDisplay = document.getElementById('questionDisplay');
const answerDisplay = document.getElementById('answerDisplay');

// 音频相关变量
let mediaRecorder;
let mediaStream;
let webSocket; // WebSocket连接
let sessionId; // 会话ID
let isPaused = false; // 面试暂停状态

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 绑定事件
    bindEvents();
    
    // 初始化WebSocket连接
    initWebSocket();
    
    // 开始录音
    startRecording();
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
    // 生成会话ID
    sessionId = 'session_' + Date.now();
    
    // 创建WebSocket连接
    const wsUrl = `ws://127.0.0.1:8081/audio/stream?sessionId=${sessionId}`;
    webSocket = new WebSocket(wsUrl);
    
    // 连接打开事件
    webSocket.onopen = function(event) {
        console.log('WebSocket连接已建立');
    };
    
    // 接收消息事件
    webSocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
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

// 开始录音
async function startRecording() {
    try {
        // 获取用户媒体权限
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 创建媒体录制器
        mediaRecorder = new MediaRecorder(mediaStream);
        
        // 设置录制数据的格式为WebM
        mediaRecorder.mimeType = 'audio/webm;codecs=opus';
        
        // 监听数据可用事件，实时发送音频数据到后端
        mediaRecorder.ondataavailable = event => {
            // 只有在非暂停状态下才发送数据
            if (event.data.size > 0 && webSocket.readyState === WebSocket.OPEN && !isPaused) {
                // 将音频数据作为Blob发送到后端
                webSocket.send(event.data);
            }
        };
        
        // 开始录制，每100毫秒发送一次数据
        mediaRecorder.start(100);
        
        console.log('录音已开始');
    } catch (error) {
        console.error('无法访问麦克风:', error);
        alert('无法访问麦克风，请检查权限设置');
    }
}

// 暂停/恢复面试
function togglePause() {
    isPaused = !isPaused;
    
    if (isPaused) {
        // 暂停时停止录音轨道
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stream.getTracks().forEach(track => track.enabled = false);
        }
        pauseInterviewBtn.textContent = '恢复面试';
        console.log('面试已暂停');
    } else {
        // 恢复时重新启用录音轨道
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stream.getTracks().forEach(track => track.enabled = true);
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
    // 停止录音（如果正在进行）
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        // 停止所有音频轨道
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
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