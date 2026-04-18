const BASE = "http://127.0.0.1:8000";

function log(msg) {
  document.getElementById("log").textContent =
    JSON.stringify(msg, null, 2);
}

function getUserId() {
  return document.getElementById("userId").value;
}

async function start() {
  const res = await fetch(`${BASE}/auth/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: getUserId()
    })
  });

  const data = await res.json();
  log(data);

  if (data.ok && data.data && data.data.auth_state === "authorizationStateReady") {
    localStorage.setItem("user_id", getUserId());
    alert("Login success!");
    window.location.href = "index.html";
  }
}

async function sendPhone() {
  const res = await fetch(`${BASE}/auth/phone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: getUserId(),
      phone_number: document.getElementById("phone").value
    })
  });

  const data = await res.json();
  log(data);
}

async function sendCode() {
  const res = await fetch(`${BASE}/auth/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: getUserId(),
      code: document.getElementById("code").value
    })
  });

  const data = await res.json();
  log(data);

  checkReady();
}

async function sendPassword() {
  const res = await fetch(`${BASE}/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: getUserId(),
      password: document.getElementById("password").value
    })
  });

  const data = await res.json();
  log(data);

  checkReady();
}

async function checkReady() {
  const res = await fetch(`${BASE}/auth/state/${getUserId()}`);
  const data = await res.json();

  log(data);

  if (data.data.auth_state === "authorizationStateReady") {
    localStorage.setItem("user_id", getUserId());
    alert("Login success!");
    window.location.href = "index.html";
  }
}