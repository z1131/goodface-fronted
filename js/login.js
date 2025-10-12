// 独立登录页脚本（开发态支持游客与本地验证码登录）

const DEV_MODE = false; // 开发阶段接入后端服务
const BACKEND_BASE_URL = window.location.origin; // 生产使用同域，配合 Nginx 反代

// 元素绑定
const phoneLoginTrigger = document.getElementById('phoneLoginTrigger');
const guestLoginTrigger = document.getElementById('guestLoginTrigger');
const phoneForm = document.getElementById('phoneForm');
const phoneInput = document.getElementById('phoneInput');
const codeInput = document.getElementById('codeInput');
const sendCodeBtn = document.getElementById('sendCodeBtn');
const loginByCodeBtn = document.getElementById('loginByCodeBtn');
const devHint = document.getElementById('devHint');
const createAccountBtn = document.getElementById('createAccountBtn');

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
});

function bindEvents() {
  // 展示手机号登录表单
  if (phoneLoginTrigger && phoneForm) {
    // 禁用手机号登录按钮的点击事件
    phoneLoginTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      return false;
    });
  }

  // 游客登录
  if (guestLoginTrigger) {
    guestLoginTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      handleGuestLogin();
    });
  }

  // 发送验证码（开发态本地生成）
  if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', () => {
      handleSendCode();
    });
  }

  // 验证码登录
  if (loginByCodeBtn) {
    loginByCodeBtn.addEventListener('click', () => {
      handlePhoneLogin();
    });
  }

  // 导航到已有页面
  if (createAccountBtn) {
    createAccountBtn.addEventListener('click', () => {
      // 跳转到用户中心页的注册表单
      window.location.href = 'user.html';
    });
  }
}

function handleGuestLogin() {
  if (DEV_MODE) {
    // 开发态：不生成 token，标注游客角色与基础能力
    const user = {
      username: '游客',
      email: 'guest@example.com',
      token: null,
      balance: '0.00',
      membership: '游客',
      role: 'guest',
      capabilities: ['basic']
    };
    localStorage.setItem('interviewUser', JSON.stringify(user));
    alert('已进入游客模式（功能受限）');
    // 跳转到面试配置页（仍视为未登录，仅可基础模型）
    window.location.href = 'config.html';
    return;
  }

  // 真实后端登录
  fetch(BACKEND_BASE_URL + '/api/user/guest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).then(r => r.json()).then(res => {
    if (res.success) {
      const user = {
        username: res.username,
        email: res.email,
        token: res.token || null, // 后端不下发 token 时为未登录态
        balance: res.balance,
        membership: res.membership || '游客',
        role: res.role || 'guest',
        capabilities: res.capabilities || ['basic']
      };
      localStorage.setItem('interviewUser', JSON.stringify(user));
      alert('已进入游客模式（功能受限）');
      window.location.href = 'config.html';
    } else {
      alert(res.message || '登录失败');
    }
  }).catch(err => {
    console.error('登录错误:', err);
    alert('登录失败，请稍后重试');
  });
}

function handleSendCode() {
  const phone = (phoneInput.value || '').trim();
  if (!/^\d{11}$/.test(phone)) {
    alert('请输入有效的11位手机号');
    return;
  }

  // 锁定检查
  const lockUntil = getLockUntil(phone);
  if (lockUntil && Date.now() < lockUntil) {
    const left = Math.ceil((lockUntil - Date.now()) / 60000);
    alert('该手机号已临时锁定，请 ' + left + ' 分钟后重试');
    return;
  }

  if (DEV_MODE) {
    const mockCode = generateMockCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟有效
    setMockCode(phone, { code: mockCode, expiresAt });
    resetAttempt(phone);
    devHint.style.display = 'block';
    alert('开发模式：验证码 ' + mockCode + ' 已生成（不会实际发送短信）');
    startCooldown(sendCodeBtn, 60);
    return;
  }

  // 预留真实后端接入
  fetch(BACKEND_BASE_URL + '/api/user/sms/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  }).then(r => r.json()).then(res => {
    if (res.success) {
      // 生产环境不会返回code，这里仅用于开发模式
      if (res.code) {
        alert('开发模式：验证码 ' + res.code + ' 已生成（不会实际发送短信）');
      } else {
        alert('验证码已发送');
      }
      startCooldown(sendCodeBtn, 60);
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
    const lockUntil = getLockUntil(phone);
    if (lockUntil && Date.now() < lockUntil) {
      const left = Math.ceil((lockUntil - Date.now()) / 60000);
      alert('该手机号已临时锁定，请 ' + left + ' 分钟后重试');
      return;
    }

    const store = getMockCode(phone);
    if (!store) {
      alert('请先发送验证码');
      return;
    }
    if (Date.now() > store.expiresAt) {
      alert('验证码已过期，请重新发送');
      return;
    }
    if (store.code !== code) {
      const attempts = incAttempt(phone);
      if (attempts >= 3) {
        setLockUntil(phone, Date.now() + 15 * 60 * 1000); // 错误3次锁定15分钟
        alert('错误次数过多，已锁定 15 分钟');
      } else {
        alert('验证码错误，剩余可重试次数：' + (3 - attempts));
      }
      return;
    }
    // 验证成功
    clearMockCode(phone);
    resetAttempt(phone);
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
    window.location.href = 'config.html';
    return;
  }

  // 真实后端登录
  fetch(BACKEND_BASE_URL + '/api/user/loginByCode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code })
  }).then(r => r.json()).then(res => {
    if (res.success) {
      const user = {
        username: res.username || ('用户' + phone.slice(-4)),
        email: res.email || ('user' + phone.slice(-4) + '@example.com'),
        token: res.token,
        balance: res.balance || '0.00',
        membership: res.membership || '普通用户'
      };
      localStorage.setItem('interviewUser', JSON.stringify(user));
      alert('登录成功！');
      window.location.href = 'config.html';
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

// 本地存储结构与工具函数
function setMockCode(phone, payload) {
  try {
    localStorage.setItem('mockSms:' + phone, JSON.stringify(payload));
  } catch {}
}
function getMockCode(phone) {
  try {
    const raw = localStorage.getItem('mockSms:' + phone);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function clearMockCode(phone) {
  localStorage.removeItem('mockSms:' + phone);
}
function resetAttempt(phone) {
  localStorage.setItem('mockSmsAttempt:' + phone, '0');
}
function incAttempt(phone) {
  const v = parseInt(localStorage.getItem('mockSmsAttempt:' + phone) || '0', 10) + 1;
  localStorage.setItem('mockSmsAttempt:' + phone, String(v));
  return v;
}
function setLockUntil(phone, ts) {
  localStorage.setItem('mockSmsLock:' + phone, String(ts));
}
function getLockUntil(phone) {
  const v = parseInt(localStorage.getItem('mockSmsLock:' + phone) || '0', 10);
  return v > 0 ? v : null;
}

// 发送按钮倒计时
function startCooldown(btn, seconds) {
  btn.disabled = true;
  const original = btn.textContent;
  let left = seconds;
  btn.textContent = `重新发送(${left}s)`;
  const timer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = original;
    } else {
      btn.textContent = `重新发送(${left}s)`;
    }
  }, 1000);
}