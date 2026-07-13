#!/usr/bin/env node
/* ============================================================
   TELEMETRY DASHBOARD — Queries Firestore notificationTelemetry
   collection and prints a summary report.
   Usage: node scripts/check-telemetry.js
   Requires: FIREBASE_SERVICE_ACCOUNT env var or default creds
   ============================================================ */
'use strict';

async function main() {
  console.log('\n  Notification Telemetry Report');
  console.log('  ================================\n');

  let admin;
  try {
    admin = require('firebase-admin');
    admin.initializeApp({
      projectId: 'my-team-chat-2255'
    });
  } catch (e) {
    console.log('  Firebase Admin not available. Showing mock report.\n');
    printMockReport();
    return;
  }

  const db = admin.firestore();
  const oneDayAgo = Date.now() - 86400000;

  try {
    const snapshot = await db.collection('notificationTelemetry')
      .where('ts', '>=', oneDayAgo)
      .orderBy('ts', 'desc')
      .limit(1000)
      .get();

    if (snapshot.empty) {
      console.log('  No telemetry data in the last 24 hours.\n');
      return;
    }

    const events = snapshot.docs.map(d => d.data());

    const byEvent = {};
    events.forEach(e => {
      byEvent[e.event] = (byEvent[e.event] || 0) + 1;
    });

    console.log('  Event Summary (last 24h):');
    Object.entries(byEvent)
      .sort((a, b) => b[1] - a[1])
      .forEach(([event, count]) => {
        console.log(`    ${event.padEnd(30)} ${count}`);
      });

    const pushReceived = events.filter(e => e.event === 'push_received');
    const withLatency = pushReceived.filter(e => e.data?.latencyMs != null);
    if (withLatency.length > 0) {
      const avgLatency = Math.round(withLatency.reduce((s, e) => s + e.data.latencyMs, 0) / withLatency.length);
      const maxLatency = Math.max(...withLatency.map(e => e.data.latencyMs));
      console.log(`\n  Push Latency:`);
      console.log(`    Average:  ${avgLatency}ms`);
      console.log(`    Max:      ${maxLatency}ms`);
      console.log(`    Samples:  ${withLatency.length}`);
    }

    const missed = events.filter(e => e.event === 'notif_missed');
    if (missed.length > 0) {
      console.log(`\n  Missed Notifications: ${missed.length}`);
      const reasons = {};
      missed.forEach(e => { reasons[e.data?.reason || 'unknown'] = (reasons[e.data?.reason || 'unknown'] || 0) + 1; });
      Object.entries(reasons).forEach(([reason, count]) => {
        console.log(`    ${reason.padEnd(30)} ${count}`);
      });
    }

    const callFailed = events.filter(e => e.event === 'call_failed');
    if (callFailed.length > 0) {
      console.log(`\n  Call Failures: ${callFailed.length}`);
      const reasons = {};
      callFailed.forEach(e => { reasons[e.data?.reason || 'unknown'] = (reasons[e.data?.reason || 'unknown'] || 0) + 1; });
      Object.entries(reasons).forEach(([reason, count]) => {
        console.log(`    ${reason.padEnd(30)} ${count}`);
      });
    }

    console.log('');
  } catch (e) {
    console.log(`  Error querying telemetry: ${e.message}`);
    printMockReport();
  }

  function printMockReport() {
    console.log('  Event Summary (last 24h) — SAMPLE:');
    console.log('    push_received                  1,247');
    console.log('    notif_shown                    1,239');
    console.log('    badge_update                     892');
    console.log('    call_ringing                      34');
    console.log('    call_connected                    28');
    console.log('    call_ended                        31');
    console.log('    notif_missed                       8');
    console.log('    call_failed                        3');
    console.log('    push_delayed                      12');
    console.log('    mute_action                       45');
    console.log('    dnd_active                        67');
    console.log('');
    console.log('  Push Latency:');
    console.log('    Average:  340ms');
    console.log('    Max:      2,100ms');
    console.log('    Samples:  1,247');
    console.log('');
  }

  process.exit(0);
}

main();
