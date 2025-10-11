// 面试进行页面JavaScript逻辑

// 页面元素
const pauseInterviewBtn = document.getElementById('pauseInterview');
const endInterviewBtn = document.getElementById('endInterview');
const questionDisplay = document.getElementById('questionDisplay');
const answerDisplay = document.getElementById('answerDisplay');
const timerDisplay = document.getElementById('interviewTimer');
let answerStarted = false; // 是否已开始接收答案流
let answerBuffer = ""; // 累积答案文本用于 Markdown 渲染

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

// 计时器相关变量
let timerInterval = null;
let elapsedMs = 0;
let timerRunning = false;

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}

function updateTimerDisplay() {
    if (timerDisplay) timerDisplay.textContent = formatTime(elapsedMs);
}

function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    const base = Date.now() - elapsedMs;
    timerInterval = setInterval(() => {
        elapsedMs = Date.now() - base;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerRunning = false;
}

// 简易 Markdown 渲染（常用子集）：代码块、行内代码、标题、加粗、斜体、链接、列表与段落
function renderMarkdown(text) {
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
    let t = String(text || '');
    // ```code```
    t = t.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${esc(code)}</code></pre>`);
    // `code`
    t = t.replace(/`([^`]+)`/g, (_, code) => `<code>${esc(code)}</code>`);
    // Headings
    t = t.replace(/^######\s*(.*)$/gm, '<h6>$1</h6>')
         .replace(/^#####\s*(.*)$/gm, '<h5>$1</h5>')
         .replace(/^####\s*(.*)$/gm, '<h4>$1</h4>')
         .replace(/^###\s*(.*)$/gm, '<h3>$1</h3>')
         .replace(/^##\s*(.*)$/gm, '<h2>$1</h2>')
         .replace(/^#\s*(.*)$/gm, '<h1>$1</h1>');
    // Bold / Italic
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Links
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Bullet list
    t = t.replace(/^(?:- |\* )(.*(?:\n(?:- |\* ).*)*)$/gm, (m) => {
        const items = m.split(/\n/).map(l => l.replace(/^(?:- |\* )/, '').trim()).map(i => `<li>${i}</li>`).join('');
        return `<ul>${items}</ul>`;
    });
    // Paragraphs & line breaks（避免破坏已生成的块级标签）
    t = t.split(/\n\n+/).map(block => {
        // 以<开头的认为已是块级，直接透传；否则包裹为<p>
        if (/^\s*</.test(block)) return block.replace(/\n/g, '<br>');
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    return t;
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 绑定事件
    bindEvents();
    
    // 初始化WebSocket连接
    initWebSocket();

    // 启动计时器
    updateTimerDisplay();
    startTimer();
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
    // 优先使用portal下发的wsUrl与sessionId（必须存在）
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
    // 没有有效的会话信息，返回配置页重新创建会话
    if (!wsUrl || !sessionId) {
        alert('未找到有效会话，请返回配置页重新开始面试。');
        window.location.href = 'config.html';
        return;
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
                    const endTag = document.createElement('p');
                    endTag.style.color = '#27ae60';
                    endTag.textContent = '[回答结束]';
                    answerDisplay.appendChild(endTag);
                    answerStarted = false;
                    // 保持最终内容已渲染，无需追加操作
                } else if (typeof data.content === 'string' && data.content.length > 0) {
                    appendAnswerChunk(data.content);
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
        // 暂停计时
        stopTimer();
        pauseInterviewBtn.textContent = '恢复面试';
        console.log('面试已暂停');
    } else {
        // 恢复：重新启用轨道
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.enabled = true);
        }
        // 继续计时
        startTimer();
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
    // 统一走 Markdown 渲染（如库不可用则回退纯文本）
    answerStarted = true;
    answerBuffer = answer || '';
    answerDisplay.innerHTML = renderMarkdown(answerBuffer);
    // 滚动到最新内容
    answerDisplay.scrollTop = answerDisplay.scrollHeight;
}

// 追加答案增量片段：移除占位符，按文本节点追加，更稳定
function appendAnswerChunk(text) {
    try {
        if (!answerStarted) {
            // 清空占位符
            answerDisplay.innerHTML = '';
            answerStarted = true;
            answerBuffer = '';
        }
        // 累积文本并用 Markdown 渲染，若库不可用则回退追加纯文本
        answerBuffer += text;
        answerDisplay.innerHTML = renderMarkdown(answerBuffer);
        // 自动滚动到最新
        answerDisplay.scrollTop = answerDisplay.scrollHeight;
    } catch (e) {
        console.error('追加答案片段失败:', e);
    }
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
    // 停止计时
    stopTimer();
    
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