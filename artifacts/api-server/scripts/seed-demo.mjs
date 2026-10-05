const baseUrl = (
  process.env.INCI_API_BASE_URL ??
  `http://127.0.0.1:${process.env.PORT ?? "8080"}/api`
).replace(/\/$/, "");

const samples = [
  {
    title: "[Sample] Oracle database listener refuses connections",
    description:
      "Oracle database clients receive connection refused from the listener endpoint after a service restart. The database host responds, but the listener is not accepting sessions.",
    priority: "high",
    resolution:
      "Restarted the Oracle listener using the approved runbook and confirmed connections from a test client.",
    verified: false,
  },
  {
    title: "[Sample] Shared folder returns permission denied",
    description:
      "A team member can sign in but receives permission denied when opening the shared operations folder.",
    priority: "medium",
    status: "escalated",
  },
  {
    title: "[Sample] Mobile mail is no longer syncing",
    description:
      "New messages appear in desktop mail but are missing from the configured mobile mail client.",
    priority: "low",
    resolution:
      "Checked the approved sync settings and confirmed new messages arrived on the mobile client.",
    verified: true,
  },
];

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `IncidAI API returned ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

for (const sample of samples) {
  const existing = await request(
    `/incidents?search=${encodeURIComponent(sample.title)}&limit=100`,
  );
  if (existing.results.some((incident) => incident.title === sample.title)) {
    continue;
  }

  const incident = await request("/incidents", {
    method: "POST",
    body: JSON.stringify({
      title: sample.title,
      description: sample.description,
      priority: sample.priority,
    }),
  });

  if (sample.status) {
    await request(`/incidents/${incident.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: sample.status }),
    });
  } else if (sample.resolution) {
    await request(`/incidents/${incident.id}/resolve`, {
      method: "POST",
      body: JSON.stringify({
        resolution: sample.resolution,
        verified: sample.verified,
      }),
    });
  }
}

process.stdout.write("Three sample incidents are available in the development database.\n");
