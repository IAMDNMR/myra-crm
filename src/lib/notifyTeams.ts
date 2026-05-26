export async function notifyTeams(
  webhookUrl: string,
  eventType: 'deal_won' | 'deal_stage_changed' | 'new_lead' | 'task_overdue',
  payload: Record<string, any>
) {
  if (!webhookUrl) return;

  const titles: Record<string, string> = {
    deal_won: '🎉 Deal Won!',
    deal_stage_changed: '📋 Deal Stage Changed',
    new_lead: '🆕 New Lead',
    task_overdue: '⚠️ Task Overdue',
  };

  const facts = Object.entries(payload)
    .filter(([, v]) => v != null)
    .map(([k, v]) => ({ title: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: String(v) }));

  const card = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: titles[eventType] ?? eventType, weight: 'Bolder', size: 'Medium' },
          { type: 'FactSet', facts },
          { type: 'TextBlock', text: `MYRA CRM · ${new Date().toLocaleString()}`, size: 'Small', isSubtle: true },
        ],
      },
    }],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
  } catch (e) {
    console.warn('Teams notification failed', e);
  }
}
