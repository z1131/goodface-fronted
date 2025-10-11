// 面试配置页面JavaScript逻辑

// 页面元素
const configForm = document.getElementById('configForm');
const loginPrompt = document.getElementById('loginPrompt');
const goToLoginBtn = document.getElementById('goToLogin');
const modelSelect = document.getElementById('model');
const loginModal = document.getElementById('loginModal');
const modalLoginForm = document.getElementById('modalLoginForm');
const modalPhoneLoginForm = document.getElementById('modalPhoneLoginForm');
const modalRegisterForm = document.getElementById('modalRegisterForm');
const modalCloseBtns = document.querySelectorAll('.modal .close');
const modalTabBtns = document.querySelectorAll('.modal .tab-btn');
const modalSendCodeBtn = document.getElementById('modalSendCodeBtn');
const showRegisterModalLink = document.getElementById('showRegisterModal');
const showLoginModalLink = document.getElementById('showLoginModal');
const registerModalContent = document.getElementById('registerModalContent');
const loginModalContent = document.querySelector('.modal-content:not(#registerModalContent)');

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 检查用户登录状态
    try { checkLoginStatus(); } catch (e) { console.warn('checkLoginStatus执行异常', e); }
    
    // 绑定事件
    try { bindEvents(); } catch (e) { console.warn('bindEvents执行异常', e); }
});

// 检查用户登录状态
function checkLoginStatus() {
    // 从localStorage获取用户信息
    const user = safeGetUser();
    
    if (user && user.token) {
        // 已登录，启用所有模型选项
        enableAllModels();
        // 隐藏登录提示
        if (loginPrompt) loginPrompt.style.display = 'none';
    } else {
        // 未登录，显示登录提示
        if (loginPrompt) loginPrompt.style.display = 'block';
        // 禁用高级模型选项
        disableAdvancedModels();
    }
}

// 启用所有模型选项
function enableAllModels() {
    if (!modelSelect) return;
    const options = modelSelect.querySelectorAll('option');
    options.forEach(option => {
        option.disabled = false;
    });
    const info = document.getElementById('modelInfo');
    if (info) info.textContent = '已登录，可使用所有模型';
}

// 禁用高级模型选项
function disableAdvancedModels() {
    if (!modelSelect) return;
    const options = modelSelect.querySelectorAll('option[value="advanced"], option[value="premium"]');
    options.forEach(option => {
        option.disabled = true;
    });
    const info = document.getElementById('modelInfo');
    if (info) info.textContent = '基础模型功能有限，登录后可解锁更多高级功能';
}

// 绑定事件
function bindEvents() {
    // 显示登录模态框
    if (goToLoginBtn) goToLoginBtn.addEventListener('click', function() {
        // 重置模态框显示状态
        if (registerModalContent) registerModalContent.style.display = 'none';
        if (loginModalContent) loginModalContent.style.display = 'block';
        if (loginModal) loginModal.style.display = 'block';
        // 默认切换到手机号登录标签，贴合 login 页风格
        modalTabBtns.forEach(b => b.classList.remove('active'));
        const phoneTab = Array.from(modalTabBtns).find(b => b.getAttribute('data-tab') === 'phone');
        if (phoneTab) phoneTab.classList.add('active');
        if (modalPhoneLoginForm) modalPhoneLoginForm.style.display = 'block';
        if (modalLoginForm) {
            modalLoginForm.classList.remove('active');
            modalLoginForm.style.display = 'none';
        }
    });
    
    // 关闭模态框
    if (modalCloseBtns && modalCloseBtns.length) {
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                if (loginModal) loginModal.style.display = 'none';
            });
        });
    }
    
    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
        if (loginModal && event.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });
    
    // 登录标签切换
    if (modalTabBtns && modalTabBtns.length) {
        modalTabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const tab = this.getAttribute('data-tab');
                modalTabBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                if (tab === 'username') {
                    if (modalLoginForm) {
                        modalLoginForm.classList.add('active');
                        modalLoginForm.style.display = 'block';
                    }
                    if (modalPhoneLoginForm) modalPhoneLoginForm.style.display = 'none';
                } else {
                    if (modalPhoneLoginForm) modalPhoneLoginForm.style.display = 'block';
                    if (modalLoginForm) {
                        modalLoginForm.classList.remove('active');
                        modalLoginForm.style.display = 'none';
                    }
                }
            });
        });
    }
    
    // 显示注册表单
    if (showRegisterModalLink) {
        showRegisterModalLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (loginModalContent) loginModalContent.style.display = 'none';
            if (registerModalContent) registerModalContent.style.display = 'block';
        });
    }
    
    // 显示登录表单
    if (showLoginModalLink) {
        showLoginModalLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (registerModalContent) registerModalContent.style.display = 'none';
            if (loginModalContent) loginModalContent.style.display = 'block';
        });
    }
    
    // 发送验证码
    if (modalSendCodeBtn) {
        modalSendCodeBtn.addEventListener('click', function() {
            handleSendCode();
        });
    }
    
    // 用户名密码登录表单提交
    if (modalLoginForm) {
        modalLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }
    
    // 手机号验证码登录表单提交
    if (modalPhoneLoginForm) {
        modalPhoneLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handlePhoneLogin();
        });
    }
    
    // 注册表单提交
    if (modalRegisterForm) {
        modalRegisterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleRegister();
        });
    }
    
    // 表单提交
    if (configForm) {
        configForm.addEventListener('submit', function(e) {
            e.preventDefault();
            startInterview();
        });
    }
}

// 处理用户名密码登录
function handleLogin() {
    const username = document.getElementById('modalUsername').value;
    const password = document.getElementById('modalPassword').value;
    
    // 简单验证
    if (!username || !password) {
        alert('请输入用户名和密码');
        return;
    }
    
    // 发送登录请求
    fetch('http://127.0.0.1:8081/api/user/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            // 登录成功
            const userData = result.data;
            const user = {
                username: userData.username,
                email: `${userData.username}@example.com`,
                token: userData.token,
                balance: '50.00',
                membership: '高级会员'
            };
            
            // 保存用户信息到localStorage
            localStorage.setItem('interviewUser', JSON.stringify(user));
            
            // 关闭模态框
            loginModal.style.display = 'none';
            
            // 更新页面状态
            checkLoginStatus();
            
            // 显示成功消息
            alert('登录成功！');
        } else {
            // 登录失败
            alert(result.message);
        }
    })
    .catch(error => {
        console.error('登录错误:', error);
        alert('登录失败，请稍后重试');
    });
}

// 处理手机号验证码登录
function handlePhoneLogin() {
    const phone = document.getElementById('modalPhone').value;
    const code = document.getElementById('modalCode').value;
    
    // 简单验证
    if (!phone || !code) {
        alert('请输入手机号和验证码');
        return;
    }
    
    // 发送登录请求
    fetch('http://127.0.0.1:8081/api/user/loginByCode', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone: phone,
            code: code
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 登录成功
            const user = {
                username: 'user_' + phone,
                email: `${phone}@example.com`,
                token: data.token,
                balance: '0.00',
                membership: '普通用户'
            };
            
            // 保存用户信息到localStorage
            localStorage.setItem('interviewUser', JSON.stringify(user));
            
            // 关闭模态框
            loginModal.style.display = 'none';
            
            // 更新页面状态
            checkLoginStatus();
            
            // 显示成功消息
            alert('登录成功！');
        } else {
            // 登录失败
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('登录错误:', error);
        alert('登录失败，请稍后重试');
    });
}

// 处理发送验证码
function handleSendCode() {
    const phone = document.getElementById('modalPhone').value;
    
    if (!phone) {
        alert('请输入手机号');
        return;
    }
    
    // 禁用按钮并显示倒计时
    modalSendCodeBtn.disabled = true;
    let countdown = 60;
    modalSendCodeBtn.textContent = `${countdown}秒后重发`;
    
    const countdownInterval = setInterval(() => {
        countdown--;
        modalSendCodeBtn.textContent = `${countdown}秒后重发`;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            modalSendCodeBtn.disabled = false;
            modalSendCodeBtn.textContent = '发送验证码';
        }
    }, 1000);
    
    // 发送请求
    fetch('http://127.0.0.1:8081/api/user/sendCode', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone: phone
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            clearInterval(countdownInterval);
            modalSendCodeBtn.disabled = false;
            modalSendCodeBtn.textContent = '发送验证码';
            alert(data.message);
        }
    })
    .catch(error => {
        clearInterval(countdownInterval);
        modalSendCodeBtn.disabled = false;
        modalSendCodeBtn.textContent = '发送验证码';
        console.error('发送验证码错误:', error);
        alert('验证码发送失败，请稍后重试');
    });
}

// 处理注册
function handleRegister() {
    const username = document.getElementById('modalRegUsername').value;
    const email = document.getElementById('modalRegEmail').value;
    const password = document.getElementById('modalRegPassword').value;
    const confirmPassword = document.getElementById('modalRegConfirmPassword').value;
    
    // 简单验证
    if (!username || !email || !password || !confirmPassword) {
        alert('请填写所有字段');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('两次输入的密码不一致');
        return;
    }
    
    // 发送注册请求
    fetch('http://127.0.0.1:8081/api/user/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            email: email,
            password: password
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            // 注册成功，直接登录
            const user = {
                username: username,
                email: email,
                token: 'fake-jwt-token',
                balance: '0.00',
                membership: '普通用户'
            };
            
            // 保存用户信息到localStorage
            localStorage.setItem('interviewUser', JSON.stringify(user));
            
            // 关闭模态框
            loginModal.style.display = 'none';
            
            // 更新页面状态
            checkLoginStatus();
            
            // 显示成功消息
            alert('注册成功！');
        } else {
            // 注册失败
            alert(result.message);
        }
    })
    .catch(error => {
        console.error('注册错误:', error);
        alert('注册失败，请稍后重试');
    });
}

// 开始面试
function startInterview() {
    const model = document.getElementById('model') ? document.getElementById('model').value : '';
    const prompt = document.getElementById('prompt') ? document.getElementById('prompt').value.trim() : '';
    
    // 验证必填字段（模型与提示词）
    if (!model || !prompt) {
        alert('请填写所有必填字段');
        return;
    }
    
    // 检查是否选择了需要登录的模型但未登录
    const user = safeGetUser();
    if ((model === 'advanced' || model === 'premium') && (!user || !user.token)) {
        alert('该模型需要登录后才能使用，请先登录！');
        // 显示登录模态框
        loginModal.style.display = 'block';
        return;
    }
    
    // 保存配置到localStorage
    const config = {
        model: model,
        prompt: prompt,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('interviewConfig', JSON.stringify(config));

    // 通过portal创建会话并获取wsUrl
    fetch('http://127.0.0.1:8001/api/interview/session', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config })
    })
    .then(resp => resp.json())
    .then(result => {
        if (result && result.code === 200 && result.data && result.data.wsUrl) {
            localStorage.setItem('interviewSession', JSON.stringify(result.data));
            window.location.href = 'interview.html';
        } else {
            console.warn('会话创建失败，使用本地兜底:', result);
            const fallback = {
                sessionId: 'sess_' + Date.now(),
                wsUrl: 'ws://127.0.0.1:8003/audio/stream?sessionId=' + ('sess_' + Date.now())
            };
            localStorage.setItem('interviewSession', JSON.stringify(fallback));
            window.location.href = 'interview.html';
        }
    })
    .catch(err => {
        console.warn('会话创建异常，使用本地兜底:', err);
        const fallbackId = 'sess_' + Date.now();
        const fallback = {
            sessionId: fallbackId,
            wsUrl: 'ws://127.0.0.1:8003/audio/stream?sessionId=' + fallbackId
        };
        localStorage.setItem('interviewSession', JSON.stringify(fallback));
        window.location.href = 'interview.html';
    });
}

// 安全读取用户信息，避免本地存储非 JSON 导致解析错误
function safeGetUser() {
    try {
        const raw = localStorage.getItem('interviewUser');
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.warn('本地用户信息损坏，已清空', e);
        localStorage.removeItem('interviewUser');
        return {};
    }
}

// 暴露函数供调试使用
window.checkLoginStatus = checkLoginStatus;