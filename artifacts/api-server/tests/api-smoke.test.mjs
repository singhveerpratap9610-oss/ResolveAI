import assert from "node:assert/strict";
import { test } from "node:test";

const baseUrl = (
  process.env.INCI_API_BASE_URL ??
  `http://127.0.0.1:${process.env.PORT ?? "8080"}/api`
).replace(/\/$/, "");

async function request(path, { expected = 200, ...init } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload =
    response.status === 204 ? null : await response.json().catch(() => null);
  assert.equal(
    response.status,
    expected,
    `Expected HTTP ${expected}, got ${response.status}: ${JSON.stringify(payload)}`,
  );
  return payload;
}

test("incident API supports a persisted report-to-resolution lifecycle", async () => {
  const before = await request("/dashboard");
  await request("/healthz").then((health) => {
    assert.equal(health.database, "connected");
    assert.equal(health.classifier, "ready");
  });
  const categories = await request("/categories");
  assert.ok(categories.length > 0, "historical categories should be available");

  const title = `Smoke test: VPN authentication ${Date.now()}`;
  let incidentId;
  try {
    const created = await request("/incidents", {
      expected: 201,
      method: "POST",
      body: JSON.stringify({
        title,
        description:
          "The VPN client rejects authentication after the password was reset. Web access still works, but remote network access is blocked.",
        priority: "high",
      }),
    });
    incidentId = created.id;
    assert.ok(Number.isInteger(incidentId));
    assert.ok(created.predictedCategory);
    assert.ok(created.confidence >= 0 && created.confidence <= 1);
    assert.equal(created.status, "open");

    const detail = await request(`/incidents/${incidentId}`);
    assert.equal(detail.title, title);
    const filtered = await request(
      `/incidents?search=${encodeURIComponent(title)}`,
    );
    assert.ok(filtered.results.some((item) => item.id === incidentId));

    const analysis = await request(`/incidents/${incidentId}/analyze`, {
      method: "POST",
      body: JSON.stringify({ similarLimit: 2 }),
    });
    assert.match(analysis.method, /TF-IDF/);
    assert.ok(analysis.similarIncidents.length <= 2);
    assert.equal(analysis.incident.status, "in_progress");

    const events = await request(`/incidents/${incidentId}/events`);
    assert.ok(events.some((event) => event.eventType === "analysis"));

    const pending = await request(`/incidents/${incidentId}/resolve`, {
      method: "POST",
      body: JSON.stringify({
        resolution: "Revalidated VPN access using the approved support procedure.",
        verified: false,
      }),
    });
    assert.equal(pending.status, "in_progress");
    assert.equal(pending.resolutionVerified, false);

    const resolved = await request(`/incidents/${incidentId}/resolve`, {
      method: "POST",
      body: JSON.stringify({
        resolution:
          "Revalidated VPN access using the approved support procedure and confirmed connectivity.",
        verified: true,
      }),
    });
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.resolutionVerified, true);

    const closed = await request(`/incidents/${incidentId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "closed" }),
    });
    assert.equal(closed.status, "closed");

    const reopened = await request(`/incidents/${incidentId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress" }),
    });
    assert.equal(reopened.resolutionVerified, false);
    assert.equal(reopened.resolvedAt, null);
    assert.equal(
      reopened.resolutionMethod,
      "Resolution note; verification pending",
    );

    const reverified = await request(`/incidents/${incidentId}/resolve`, {
      method: "POST",
      body: JSON.stringify({
        resolution:
          "Revalidated VPN access using the approved support procedure and confirmed connectivity.",
        verified: true,
      }),
    });
    assert.equal(reverified.status, "resolved");
    assert.equal(reverified.resolutionVerified, true);

    const closedAgain = await request(`/incidents/${incidentId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "closed" }),
    });
    assert.equal(closedAgain.status, "closed");

    const after = await request("/dashboard");
    assert.equal(after.total, before.total + 1);
  } finally {
    if (incidentId) {
      await request(`/incidents/${incidentId}`, {
        method: "DELETE",
        expected: 204,
      });
      const missing = await request(`/incidents/${incidentId}`, {
        expected: 404,
      });
      assert.equal(missing.error, "Incident not found");
    }
  }
});
