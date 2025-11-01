// 面试进行页面JavaScript逻辑

// 页面元素
const pauseInterviewBtn = document.getElementById('pauseInterview');
const endInterviewBtn = document.getElementById('endInterview');
const questionDisplay = document.getElementById('questionDisplay');
const answerDisplay = document.getElementById('answerDisplay');

const isPreview = new URLSearchParams(window.location.search).has('preview');
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
let processorNode; // 处理节点（ScriptProcessor或AudioWorkletNode）
let audioWorkletNode; // AudioWorklet节点
let sttReady = false; // 收到后端就绪信号后才发送音频
let recordingStarted = false; // 避免重复启动录音
let useAudioWorklet = false; // 是否使用AudioWorklet

// WebSocket连接健壮性相关变量
let heartbeatInterval = null; // 心跳定时器
let reconnectAttempts = 0; // 重连尝试次数
let maxReconnectAttempts = 10; // 最大重连次数
let reconnectDelay = 1000; // 初始重连延迟（毫秒）
let maxReconnectDelay = 30000; // 最大重连延迟（毫秒）
let isReconnecting = false; // 是否正在重连
let wsUrl = null; // 保存WebSocket URL用于重连
let isManualClose = false; // 是否手动关闭连接

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
    // 如果页面上没有计时器元素，直接不启动定时器
    if (!timerDisplay) return;
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
    // 结束面试
    endInterviewBtn.addEventListener('click', endInterview);
}

// 初始化WebSocket连接
function initWebSocket() {
    // 预览模式：跳过WebSocket连接，演示UI
    if (isPreview) {
        // 预览模式：仅展示一个示例问题
        displayQuestion('请用STAR法介绍一个你主导的项目');
        return;
    }

    // 正常模式：使用portal下发的wsUrl与sessionId
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

    // 规范化 wsUrl：
    // - 如果是相对路径，以当前页面域名补齐并选择 ws/wss
    // - 如果是旧的 127.0.0.1/localhost，替换为当前页面域名
    try {
        if (wsUrl) {
            const scheme = (location.protocol === 'https:' ? 'wss' : 'ws');
            if (wsUrl.startsWith('/')) {
                wsUrl = `${scheme}://${location.host}${wsUrl}`;
            } else {
                const u = new URL(wsUrl);
                if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
                    wsUrl = `${scheme}://${location.host}${u.pathname}${u.search}`;
                }
            }
        }
    } catch (e) {
        console.warn('wsUrl 标准化失败，使用原值', e);
    }

    // 没有有效的会话信息，返回配置页重新创建会话
    if (!wsUrl || !sessionId) {
        alert('未找到有效会话，请返回配置页重新开始面试。');
        window.location.href = 'config.html';
        return;
    }

    // 重置连接状态
    isManualClose = false;
    resetReconnectState();
    
    // 使用新的连接函数
    createWebSocketConnection();
}

// 开始录音（支持AudioWorklet和ScriptProcessor降级）
async function startRecording() {
    try {
        // 获取用户媒体权限
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 创建 16kHz 的 AudioContext
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC({ sampleRate: 16000 });

        // 媒体源节点
        sourceNode = audioCtx.createMediaStreamSource(mediaStream);

        // 尝试使用AudioWorklet，失败则降级到ScriptProcessor
        try {
            await initAudioWorklet();
        } catch (workletError) {
            console.warn('AudioWorklet不可用，降级到ScriptProcessor:', workletError);
            initScriptProcessor();
        }

        recordingStarted = true;
        console.log(`录音（PCM 16kHz）已开始，使用${useAudioWorklet ? 'AudioWorklet' : 'ScriptProcessor'}；将于收到 stt_ready 后发送`);
    } catch (error) {
        console.error('无法访问麦克风:', error);
        alert('无法访问麦克风，请检查权限设置');
    }
}

// 初始化AudioWorklet
async function initAudioWorklet() {
    // 检查AudioWorklet支持
    if (!audioCtx.audioWorklet) {
        throw new Error('AudioWorklet not supported');
    }

    // 加载AudioWorklet模块
    await audioCtx.audioWorklet.addModule('js/audio-worklet-processor.js');

    // 创建AudioWorkletNode
    audioWorkletNode = new AudioWorkletNode(audioCtx, 'audio-stream-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1
    });

    // 配置采样率
    audioWorkletNode.port.postMessage({
        type: 'config',
        sampleRate: 16000
    });

    // 监听音频数据
    audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === 'audioData') {
            // 仅在收到 stt_ready 后开始发送音频
            if (sttReady && !isPaused && webSocket && webSocket.readyState === WebSocket.OPEN) {
                webSocket.send(new Uint8Array(event.data.data));
            }
        }
    };

    // 连接音频图
    sourceNode.connect(audioWorkletNode);
    useAudioWorklet = true;
}

// 初始化ScriptProcessor（降级方案）
function initScriptProcessor() {
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
            // 简单下采样至16k：抽取法（近似）
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
    useAudioWorklet = false;
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
    // 直接显示本次识别的问题文本
    const top = String(question || '').trim();
    questionDisplay.innerHTML = `<p>${top}</p>`;
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

// 侧栏候选问题功能已移除

// 结束面试
function endInterview() {
    // 标记为手动关闭，避免重连
    isManualClose = true;
    
    // 停止心跳
    stopHeartbeat();
    
    // 停止计时器
    stopTimer();
    
    // 停止录音
    if (useAudioWorklet && audioWorkletNode) {
        audioWorkletNode.disconnect();
        audioWorkletNode = null;
    } else if (processorNode) {
        processorNode.disconnect();
        processorNode = null;
    }
    
    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    // 关闭WebSocket连接
    if (webSocket) {
        webSocket.close();
        webSocket = null;
    }
    
    // 显示结束消息
    alert('面试已结束，感谢您的参与！');
    
    // 返回配置页面
    window.location.href = 'config.html';
}

// 页面卸载前检查
window.addEventListener('beforeunload', function(e) {
    // 标记为手动关闭
    isManualClose = true;
    
    // 停止心跳
    stopHeartbeat();
    
    // 关闭WebSocket连接
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.close();
    }
    
    // 停止录音
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    
    // 浏览器可能会显示确认对话框
    if (!isPreview) {
        const message = '确定要离开面试页面吗？面试进度将会丢失。';
        e.preventDefault();
        return e.returnValue = message;
    }
});
function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    heartbeatInterval = setInterval(() => {
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
            try {
                // 发送心跳ping消息
                webSocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                console.log('发送心跳ping');
            } catch (error) {
                console.error('发送心跳失败:', error);
            }
        }
    }, 30000); // 每30秒发送一次心跳
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// WebSocket重连机制
function reconnectWebSocket() {
    if (isReconnecting || isManualClose) {
        return;
    }
    
    if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('达到最大重连次数，停止重连');
        alert('连接已断开且无法重连，请刷新页面重试');
        return;
    }
    
    isReconnecting = true;
    reconnectAttempts++;
    
    // 计算指数退避延迟
    const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts - 1), maxReconnectDelay);
    
    console.log(`第${reconnectAttempts}次重连尝试，${delay}ms后开始...`);
    
    setTimeout(() => {
        if (!isManualClose) {
            console.log('开始重连WebSocket...');
            createWebSocketConnection();
        }
        isReconnecting = false;
    }, delay);
}

// 重置重连状态
function resetReconnectState() {
    reconnectAttempts = 0;
    isReconnecting = false;
}

// 创建WebSocket连接
function createWebSocketConnection() {
    if (!wsUrl || !sessionId) {
        console.error('缺少wsUrl或sessionId，无法建立连接');
        return;
    }
    
    // 关闭现有连接
    if (webSocket) {
        webSocket.onclose = null;
        webSocket.onerror = null;
        webSocket.close();
    }
    
    try {
        // 在URL中添加重连标识和sessionId
        const reconnectUrl = wsUrl + (wsUrl.includes('?') ? '&' : '?') + 
                           `reconnect=${reconnectAttempts > 0 ? 'true' : 'false'}&sessionId=${sessionId}`;
        
        webSocket = new WebSocket(reconnectUrl);
        
        // 连接打开事件
        webSocket.onopen = function(event) {
            console.log('WebSocket连接已建立');
            resetReconnectState();
            startHeartbeat();
            
            // 如果是重连，需要重新初始化录音
            if (reconnectAttempts > 0 && !recordingStarted) {
                sttReady = false; // 重置STT状态，等待新的stt_ready信号
            }
        };
        
        // 接收消息事件
        webSocket.onmessage = function(event) {
            try {
                // 处理二进制消息（可能是音频数据的响应）
                if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
                    console.log('收到二进制消息');
                    return;
                }
                
                const data = JSON.parse(event.data);
                
                // 处理心跳响应
                if (data.type === 'pong') {
                    console.log('收到心跳pong响应');
                    return;
                }
                
                if (data.type === 'stt_ready') {
                    // 后端准备就绪，开始录音与音频发送
                    sttReady = true;
                    if (!recordingStarted) {
                        startRecording();
                    }
                    return;
                }
                
                if (data.type === 'question') {
                    // 收到新问题：清空旧答案并重置缓冲
                    try {
                        answerDisplay.innerHTML = '';
                        answerBuffer = '';
                        answerStarted = false;
                    } catch (e) { console.warn('清空旧答案失败:', e); }
                    
                    displayQuestion(data.content);
                    // 不再展示侧栏候选问题
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
            console.log('WebSocket连接已关闭', event.code, event.reason);
            stopHeartbeat();
            
            // 如果不是手动关闭，尝试重连
            if (!isManualClose && !isPreview) {
                console.log('连接意外关闭，准备重连...');
                reconnectWebSocket();
            }
        };
        
        // 连接错误事件
        webSocket.onerror = function(error) {
            console.error('WebSocket错误:', error);
            stopHeartbeat();
        };
        
    } catch (error) {
        console.error('创建WebSocket连接失败:', error);
        if (!isManualClose) {
            reconnectWebSocket();
        }
    }
}