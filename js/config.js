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
    checkLoginStatus();
    
    // 绑定事件
    bindEvents();
});

// 检查用户登录状态
function checkLoginStatus() {
    // 从localStorage获取用户信息
    const user = safeGetUser();
    
    if (user && user.token) {
        // 已登录，启用所有模型选项
        enableAllModels();
        // 隐藏登录提示
        loginPrompt.style.display = 'none';
    } else {
        // 未登录，显示登录提示
        loginPrompt.style.display = 'block';
        // 禁用高级模型选项
        disableAdvancedModels();
    }
}

// 启用所有模型选项
function enableAllModels() {
    const options = modelSelect.querySelectorAll('option');
    options.forEach(option => {
        option.disabled = false;
    });
    document.getElementById('modelInfo').textContent = '已登录，可使用所有模型';
}

// 禁用高级模型选项
function disableAdvancedModels() {
    const options = modelSelect.querySelectorAll('option[value="advanced"], option[value="premium"]');
    options.forEach(option => {
        option.disabled = true;
    });
    document.getElementById('modelInfo').textContent = '基础模型功能有限，登录后可解锁更多高级功能';
}

// 绑定事件
function bindEvents() {
    // 显示登录模态框
    goToLoginBtn.addEventListener('click', function() {
        // 重置模态框显示状态
        registerModalContent.style.display = 'none';
        loginModalContent.style.display = 'block';
        loginModal.style.display = 'block';
    });
    
    // 关闭模态框
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            loginModal.style.display = 'none';
        });
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
        if (event.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });
    
    // 登录标签切换
    modalTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            modalTabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            if (tab === 'username') {
                modalLoginForm.classList.add('active');
                modalPhoneLoginForm.style.display = 'none';
                modalLoginForm.style.display = 'block';
            } else {
                modalPhoneLoginForm.style.display = 'block';
                modalLoginForm.classList.remove('active');
                modalLoginForm.style.display = 'none';
            }
        });
    });
    
    // 显示注册表单
    showRegisterModalLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginModalContent.style.display = 'none';
        registerModalContent.style.display = 'block';
    });
    
    // 显示登录表单
    showLoginModalLink.addEventListener('click', function(e) {
        e.preventDefault();
        registerModalContent.style.display = 'none';
        loginModalContent.style.display = 'block';
    });
    
    // 发送验证码
    modalSendCodeBtn.addEventListener('click', function() {
        handleSendCode();
    });
    
    // 用户名密码登录表单提交
    modalLoginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLogin();
    });
    
    // 手机号验证码登录表单提交
    modalPhoneLoginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handlePhoneLogin();
    });
    
    // 注册表单提交
    if (modalRegisterForm) {
        modalRegisterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleRegister();
        });
    }
    
    // 表单提交
    configForm.addEventListener('submit', function(e) {
        e.preventDefault();
        startInterview();
    });
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
    const model = document.getElementById('model').value;
    const industry = document.getElementById('industry').value;
    const position = document.getElementById('position').value;
    
    // 验证必填字段
    if (!model || !industry || !position) {
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
        industry: industry,
        position: position,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('interviewConfig', JSON.stringify(config));
    
    // 跳转到面试页面
    window.location.href = 'interview.html';
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