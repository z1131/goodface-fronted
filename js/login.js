// 独立登录页脚本（开发态支持游客与本地验证码登录）

const DEV_MODE = true; // 开发阶段不接入云短信

// 元素绑定
const phoneLoginTrigger = document.getElementById('phoneLoginTrigger');
const guestLoginTrigger = document.getElementById('guestLoginTrigger');
const phoneForm = document.getElementById('phoneForm');
const phoneInput = document.getElementById('phoneInput');
const codeInput = document.getElementById('codeInput');
const sendCodeBtn = document.getElementById('sendCodeBtn');
const loginByCodeBtn = document.getElementById('loginByCodeBtn');
const devHint = document.getElementById('devHint');
const signInBtn = document.getElementById('signInBtn');
const createAccountBtn = document.getElementById('createAccountBtn');

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
});

function bindEvents() {
  // 展示手机号登录表单
  phoneLoginTrigger.addEventListener('click', () => {
    phoneForm.style.display = phoneForm.style.display === 'none' || phoneForm.style.display === '' ? 'block' : 'none';
  });

  // 游客登录
  guestLoginTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    handleGuestLogin();
  });

  // 发送验证码（开发态本地生成）
  sendCodeBtn.addEventListener('click', () => {
    handleSendCode();
  });

  // 验证码登录
  loginByCodeBtn.addEventListener('click', () => {
    handlePhoneLogin();
  });

  // 导航到已有页面
  signInBtn.addEventListener('click', () => {
    // 这里指向已有的用户中心页以进行账号/短信登录
    window.location.href = 'user.html';
  });
  createAccountBtn.addEventListener('click', () => {
    // 跳转到用户中心页的注册表单
    window.location.href = 'user.html';
  });
}

function handleGuestLogin() {
  const token = 'guest-' + Math.random().toString(36).slice(2);
  const user = {
    username: '游客',
    email: 'guest@example.com',
    token,
    balance: '0.00',
    membership: '普通用户',
    capabilities: ['basic']
  };
  localStorage.setItem('interviewUser', JSON.stringify(user));
  alert('已进入游客模式（功能受限）');
  // 登录后跳转到用户中心或配置页
  window.location.href = 'user.html';
}

function handleSendCode() {
  const phone = (phoneInput.value || '').trim();
  if (!/^\d{11}$/.test(phone)) {
    alert('请输入有效的11位手机号');
    return;
  }

  if (DEV_MODE) {
    const mockCode = generateMockCode();
    localStorage.setItem('mockSmsCode:' + phone, mockCode);
    devHint.style.display = 'block';
    alert('开发模式：验证码 ' + mockCode + ' 已生成（不会实际发送短信）');
    return;
  }

  // 预留真实后端接入
  fetch('http://127.0.0.1:8081/api/user/sendCode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  }).then(r => r.json()).then(res => {
    if (res.success) {
      alert('验证码已发送');
    } else {
      alert(res.message || '发送失败');
    }
  }).catch(err => {
    console.error('发送验证码错误:', err);
    alert('发送失败，请稍后重试');
  });
}

function handlePhoneLogin() {
  const phone = (phoneInput.value || '').trim();
  const code = (codeInput.value || '').trim();
  if (!/^\d{11}$/.test(phone)) {
    alert('请输入有效的11位手机号');
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    alert('请输入6位验证码');
    return;
  }

  if (DEV_MODE) {
    const ok = devFallbackPhoneLogin(phone, code);
    if (!ok) {
      alert('验证码错误或已过期');
      return;
    }
    const token = 'dev-' + Math.random().toString(36).slice(2);
    const user = {
      username: '用户' + phone.slice(-4),
      email: 'user' + phone.slice(-4) + '@example.com',
      token,
      balance: '50.00',
      membership: '高级会员'
    };
    localStorage.setItem('interviewUser', JSON.stringify(user));
    alert('登录成功！');
    window.location.href = 'user.html';
    return;
  }

  // 真实后端登录
  fetch('http://127.0.0.1:8081/api/user/loginByCode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code })
  }).then(r => r.json()).then(res => {
    if (res.success) {
      const d = res.data || {};
      const user = {
        username: d.username || ('用户' + phone.slice(-4)),
        email: d.email || ('user' + phone.slice(-4) + '@example.com'),
        token: d.token,
        balance: d.balance || '0.00',
        membership: d.membership || '普通用户'
      };
      localStorage.setItem('interviewUser', JSON.stringify(user));
      alert('登录成功！');
      window.location.href = 'user.html';
    } else {
      alert(res.message || '登录失败');
    }
  }).catch(err => {
    console.error('登录错误:', err);
    alert('登录失败，请稍后重试');
  });
}

function generateMockCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function devFallbackPhoneLogin(phone, code) {
  const stored = localStorage.getItem('mockSmsCode:' + phone);
  return !!stored && stored === code;
}