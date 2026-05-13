import { useEffect, useMemo, useState } from "react";
import type { AppSnapshot } from "../shared/ipc";

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(timestamp);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    window.cheeseKit
      .getSnapshot()
      .then((next) => {
        if (mounted) {
          setSnapshot(next);
        }
      })
      .catch((unknownError: unknown) => {
        if (mounted) {
          setError(unknownError instanceof Error ? unknownError.message : String(unknownError));
        }
      });

    const unsubscribe = window.cheeseKit.onSnapshot((next) => setSnapshot(next));
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const manzaiStatus = useMemo(
    () => snapshot?.tools.find((tool) => tool.id === "manzai-bot"),
    [snapshot]
  );

  if (error) {
    return (
      <main className="app-shell">
        <h1>CheeseKit</h1>
        <section className="panel">
          <p className="error-text">{error}</p>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="app-shell">
        <h1>CheeseKit</h1>
        <section className="panel">
          <p>Loading local runtime...</p>
        </section>
      </main>
    );
  }

  const queuePaused = snapshot.queue.paused || snapshot.queue.emergencyStopped;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>CheeseKit</h1>
          <p>Local desktop runtime for CHZZK live-streaming tools</p>
        </div>
        <div className={`status-pill ${snapshot.connection.status}`}>
          {snapshot.connection.mode} / {snapshot.connection.status}
        </div>
      </header>

      <section className="status-grid" aria-label="Main status">
        <div className="metric-panel">
          <span>App status</span>
          <strong>{snapshot.appStatus}</strong>
        </div>
        <div className="metric-panel">
          <span>Mock CHZZK</span>
          <strong>{snapshot.connection.status}</strong>
        </div>
        <div className="metric-panel">
          <span>Active tools</span>
          <strong>{snapshot.activeToolCount}</strong>
        </div>
        <div className="metric-panel">
          <span>Queue</span>
          <strong>{snapshot.queue.queue.length} pending</strong>
        </div>
      </section>

      <section className="workspace-grid">
        <section className="panel tool-panel" aria-label="Tool panel">
          <div className="panel-heading">
            <div>
              <h2>manzai-bot</h2>
              <p>Boke / Tsukkomi chat tool</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(manzaiStatus?.running)}
                onChange={(event) => {
                  void window.cheeseKit.setManzaiEnabled(event.currentTarget.checked);
                }}
              />
              <span>{manzaiStatus?.running ? "ON" : "OFF"}</span>
            </label>
          </div>

          <div className="control-stack">
            <label>
              <span>Reaction chance</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={snapshot.manzaiConfig.reactionChance}
                onChange={(event) => {
                  void window.cheeseKit.updateManzaiConfig({
                    reactionChance: Number(event.currentTarget.value)
                  });
                }}
              />
              <strong>{percent(snapshot.manzaiConfig.reactionChance)}</strong>
            </label>
            <label>
              <span>Cooldown seconds</span>
              <input
                type="number"
                min="0"
                max="300"
                value={snapshot.manzaiConfig.cooldownSeconds}
                onChange={(event) => {
                  void window.cheeseKit.updateManzaiConfig({
                    cooldownSeconds: Number(event.currentTarget.value)
                  });
                }}
              />
            </label>
            <div className="readonly-row">
              <span>Max message length</span>
              <strong>{snapshot.queue.settings.maxMessageLength}</strong>
            </div>
            <div className="readonly-row">
              <span>Status</span>
              <strong>{manzaiStatus?.health ?? "idle"}</strong>
            </div>
            <div className="readonly-row">
              <span>Last decision</span>
              <strong>{String(manzaiStatus?.details?.lastDecision ?? "idle")}</strong>
            </div>
          </div>

          <div className="button-row">
            <button
              type="button"
              onClick={() => void window.cheeseKit.setSendingPaused(!queuePaused)}
            >
              {queuePaused ? "Resume sending" : "Pause all sending"}
            </button>
            <button type="button" onClick={() => void window.cheeseKit.setManzaiEnabled(false)}>
              Stop manzai-bot
            </button>
            <button type="button" onClick={() => void window.cheeseKit.clearQueue()}>
              Clear queue
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => void window.cheeseKit.emergencyStop()}
            >
              Emergency stop
            </button>
          </div>
        </section>

        <section className="panel queue-panel" aria-label="Send queue">
          <div className="panel-heading">
            <div>
              <h2>Send queue</h2>
              <p>{snapshot.queue.paused ? "Paused" : "Active"}</p>
            </div>
            <button type="button" onClick={() => void window.cheeseKit.resumeAfterEmergency()}>
              Clear stop
            </button>
          </div>
          <div className="queue-list">
            {snapshot.queue.queue.length === 0 ? (
              <p className="empty-text">No queued messages</p>
            ) : (
              snapshot.queue.queue.map((entry) => (
                <article key={entry.request.id} className="queue-item">
                  <span>{entry.status}</span>
                  <p>{entry.request.message}</p>
                  <small>{entry.request.toolId}</small>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel log-panel" aria-label="Event log">
          <div className="panel-heading">
            <div>
              <h2>Event log</h2>
              <p>Mock chat, bot decisions, queue, sent/failed messages</p>
            </div>
          </div>
          <div className="log-list">
            {snapshot.activity.map((entry) => (
              <article key={entry.id} className={`log-row ${entry.level}`}>
                <time>{formatTime(entry.createdAt)}</time>
                <span>{entry.source}</span>
                <p>{entry.message}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
