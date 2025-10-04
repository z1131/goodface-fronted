// 用户管理页面JavaScript逻辑

// 页面元素
const loginSection = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const profileSection = document.getElementById('profileSection');
const loginForm = document.getElementById('loginForm');
const phoneLoginForm = document.getElementById('phoneLoginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');
const rechargeBtn = document.getElementById('rechargeBtn');
const rechargeSection = document.getElementById('rechargeSection');
const rechargeOptions = document.querySelectorAll('.recharge-option');
const confirmRechargeBtn = document.getElementById('confirmRecharge');
const tabBtns = document.querySelectorAll('.tab-btn');
const sendCodeBtn = document.getElementById('sendCodeBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const loginPromptSection = document.getElementById('loginPromptSection');
const profileActions = document.getElementById('profileActions');
const userInfo = document.getElementById('userInfo');

// 检查用户登录状态
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    
    // 绑定事件
    bindEvents();
});

// 绑定事件
function bindEvents() {
    // 登录标签切换
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            if (tab === 'username') {
                loginForm.classList.add('active');
                phoneLoginForm.style.display = 'none';
                loginForm.style.display = 'block';
            } else {
                phoneLoginForm.style.display = 'block';
                loginForm.classList.remove('active');
                loginForm.style.display = 'none';
            }
        });
    });
    
    // 显示注册表单
    showRegisterLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
    });
    
    // 显示登录表单
    showLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        registerSection.style.display = 'none';
        loginSection.style.display = 'block';
    });
    
    // 显示登录表单（从提示区域）
    showLoginBtn.addEventListener('click', function(e) {
        e.preventDefault();
        loginPromptSection.style.display = 'none';
        loginSection.style.display = 'block';
    });
    
    // 用户名密码登录表单提交
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLogin();
    });
    
    // 手机号验证码登录表单提交
    phoneLoginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handlePhoneLogin();
    });
    
    // 发送验证码
    sendCodeBtn.addEventListener('click', function() {
        handleSendCode();
    });
    
    // 注册表单提交
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleRegister();
    });
    
    // 退出登录
    logoutBtn.addEventListener('click', function() {
        handleLogout();
    });
    
    // 显示充值区域
    rechargeBtn.addEventListener('click', function() {
        rechargeSection.style.display = rechargeSection.style.display === 'none' ? 'block' : 'none';
    });
    
    // 充值选项选择
    rechargeOptions.forEach(option => {
        option.addEventListener('click', function() {
            rechargeOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
    
    // 确认充值
    confirmRechargeBtn.addEventListener('click', function() {
        handleRecharge();
    });
}

// 检查登录状态
function checkLoginStatus() {
    // 从localStorage获取用户信息
    const user = JSON.parse(localStorage.getItem('interviewUser') || '{}');
    
    if (user && user.token) {
        // 已登录，显示用户信息
        showProfile(user);
    } else {
        // 未登录，显示登录提示
        showLoginPrompt();
    }
}

// 显示登录提示
function showLoginPrompt() {
    // 隐藏用户信息区域的操作按钮
    profileActions.style.display = 'none';
    
    // 显示登录提示区域
    loginPromptSection.style.display = 'block';
    
    // 隐藏登录和注册表单
    loginSection.style.display = 'none';
    registerSection.style.display = 'none';
    
    // 更新用户信息为未登录状态
    document.getElementById('loginStatus').textContent = '未登录';
    document.getElementById('profileUsername').textContent = '-';
    document.getElementById('profileEmail').textContent = '-';
    document.getElementById('accountBalance').textContent = '¥0.00';
    document.getElementById('membershipLevel').textContent = '普通用户';
}

// 显示用户信息
function showProfile(user) {
    // 隐藏登录提示区域
    loginPromptSection.style.display = 'none';
    
    // 显示用户信息区域的操作按钮
    profileActions.style.display = 'flex';
    
    // 隐藏登录和注册表单
    loginSection.style.display = 'none';
    registerSection.style.display = 'none';
    
    // 更新用户信息
    document.getElementById('loginStatus').textContent = '已登录';
    document.getElementById('profileUsername').textContent = user.username || '未知用户';
    document.getElementById('profileEmail').textContent = user.email || '未知邮箱';
    document.getElementById('accountBalance').textContent = `¥${user.balance || '0.00'}`;
    document.getElementById('membershipLevel').textContent = user.membership || '普通用户';
}

// 处理用户名密码登录
function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // 简单验证
    if (!username || !password) {
        alert('请输入用户名和密码');
        return;
    }
    
    // 发送登录请求\n    fetch('http://127.0.0.1:8081/api/user/login', {
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
            
            // 显示用户信息
            showProfile(user);
            
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
    const phone = document.getElementById('phone').value;
    const code = document.getElementById('code').value;
    
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
            
            // 显示用户信息
            showProfile(user);
            
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
    const phone = document.getElementById('phone').value;
    
    if (!phone) {
        alert('请输入手机号');
        return;
    }
    
    // 禁用按钮并显示倒计时
    sendCodeBtn.disabled = true;
    let countdown = 60;
    sendCodeBtn.textContent = `${countdown}秒后重发`;
    
    const countdownInterval = setInterval(() => {
        countdown--;
        sendCodeBtn.textContent = `${countdown}秒后重发`;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = '发送验证码';
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
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = '发送验证码';
            alert(data.message);
        }
    })
    .catch(error => {
        clearInterval(countdownInterval);
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = '发送验证码';
        console.error('发送验证码错误:', error);
        alert('验证码发送失败，请稍后重试');
    });
}

// 处理注册
function handleRegister() {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
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
            
            // 显示用户信息
            showProfile(user);
            
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

// 处理退出登录
function handleLogout() {
    // 清除用户信息
    localStorage.removeItem('interviewUser');
    
    // 显示登录提示
    showLoginPrompt();
    
    // 显示成功消息
    alert('已退出登录');
}

// 处理充值
function handleRecharge() {
    let amount = 0;
    
    // 检查是否选择了预设金额
    const selectedOption = document.querySelector('.recharge-option.selected');
    if (selectedOption) {
        amount = parseFloat(selectedOption.getAttribute('data-amount'));
    } else {
        // 检查自定义金额
        const customAmount = document.getElementById('customAmount').value;
        if (customAmount) {
            amount = parseFloat(customAmount);
        }
    }
    
    if (amount <= 0) {
        alert('请选择或输入充值金额');
        return;
    }
    
    // 模拟充值请求
    // 实际项目中这里会发送HTTP请求到后端
    setTimeout(() => {
        // 更新用户余额
        const user = JSON.parse(localStorage.getItem('interviewUser') || '{}');
        if (user) {
            const currentBalance = parseFloat(user.balance || 0);
            user.balance = (currentBalance + amount).toFixed(2);
            localStorage.setItem('interviewUser', JSON.stringify(user));
            
            // 更新页面显示
            document.getElementById('accountBalance').textContent = `¥${user.balance}`;
        }
        
        // 重置充值表单
        rechargeOptions.forEach(opt => opt.classList.remove('selected'));
        document.getElementById('customAmount').value = '';
        
        // 显示成功消息
        alert(`充值成功！充值金额：¥${amount.toFixed(2)}`);
    }, 500);
}

// 暴露一些函数供调试使用
window.checkLoginStatus = checkLoginStatus;