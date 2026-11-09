import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo;
let server;
let base;
let closeDatabase;

before(async () => {
  mongo = await MongoMemoryServer.create();
  const database = await import("../db/mongo.js");
  closeDatabase = database.closeDatabase;
  await database.connectDatabase(mongo.getUri(), "pavilion_auth_test");
  const { default: app } = await import("../app.js");
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
  await mongo.stop();
});

async function call(method, path, payload, cookie) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data =
    response.status === 204 ? null : await response.json().catch(() => null);
  return {
    status: response.status,
    data,
    setCookie: response.headers.get("set-cookie"),
  };
}

const VALID = {
  name: "Rohan Mehta",
  email: "rohan@example.com",
  password: "supersecret1",
  confirmPassword: "supersecret1",
};

test("registers a new user and never stores or returns the plain password", async () => {
  const { status, data, setCookie } = await call(
    "POST",
    "/auth/register",
    VALID,
  );
  assert.equal(status, 201);
  assert.equal(data.user.name, "Rohan Mehta");
  assert.equal(data.user.email, "rohan@example.com");
  assert.ok(data.user.id);
  assert.equal(data.user.password, undefined);
  assert.equal(data.user.passwordHash, undefined);
  assert.match(setCookie, /ph_session=/);
});

test("rejects duplicate email regardless of case", async () => {
  const { status, data } = await call("POST", "/auth/register", {
    ...VALID,
    email: "ROHAN@Example.com",
  });
  assert.equal(status, 409);
  assert.match(data.error.message, /already registered/i);
});

test("validates every field", async () => {
  const cases = [
    { ...VALID, name: "" },
    { ...VALID, email: "not-an-email" },
    { ...VALID, email: "a@b" },
    { ...VALID, password: "short" },
    { ...VALID, confirmPassword: "different" },
  ];
  for (const payload of cases) {
    const { status } = await call("POST", "/auth/register", payload);
    assert.equal(status, 400, JSON.stringify(payload));
  }
});

test("registered user can log in and a wrong password is rejected", async () => {
  const good = await call("POST", "/auth/login", {
    email: "rohan@example.com",
    password: "supersecret1",
  });
  assert.equal(good.status, 200);
  assert.equal(good.data.user.email, "rohan@example.com");
  assert.ok(good.setCookie?.includes("ph_session="));

  const bad = await call("POST", "/auth/login", {
    email: "rohan@example.com",
    password: "wrongpassword",
  });
  assert.equal(bad.status, 401);
});

test("remember me persists the cookie; without it it is a browser-session cookie", async () => {
  const remembered = await call("POST", "/auth/login", {
    email: "rohan@example.com",
    password: "supersecret1",
    remember: true,
  });
  assert.match(remembered.setCookie, /Expires|Max-Age/);

  const notRemembered = await call("POST", "/auth/login", {
    email: "rohan@example.com",
    password: "supersecret1",
    remember: false,
  });
  assert.ok(!/Expires|Max-Age/i.test(notRemembered.setCookie));

  const tampered = await call("GET", "/auth/me", undefined, "ph_session=abc.def");
  assert.equal(tampered.status, 401);
});

test("/auth/me returns the session user with the session cookie", async () => {
  const login = await call("POST", "/auth/login", {
    email: "rohan@example.com",
    password: "supersecret1",
  });
  const cookie = login.setCookie.split(";")[0];
  const me = await call("GET", "/auth/me", undefined, cookie);
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, "rohan@example.com");

  const anonymous = await call("GET", "/auth/me");
  assert.equal(anonymous.status, 401);
});

test("logout clears the session", async () => {
  const login = await call("POST", "/auth/login", {
    email: "rohan@example.com",
    password: "supersecret1",
  });
  const cookie = login.setCookie.split(";")[0];
  const out = await call("POST", "/auth/logout", {}, cookie);
  assert.equal(out.status, 204);
});
