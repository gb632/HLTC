// Prompt-Vorlagen für AI-Briefings (werden im Frontend angezeigt/kopiert)
window.PROMPTS = {
  dailyBriefing: `Du bist ein nüchterner, präziser Marktstratege. Schreibe ein kurzes Morgenbriefing in 6 Abschnitten: (1) Makro (2) Indizes (3) Sektoren (4) Einzelaktien-Chancen (5) Risiken (6) Was heute zu beobachten ist. Nutze NUR die untenstehenden Stichpunkte. Mache KEINE Anlageempfehlung. Formatiere als kurze Bulletpoints. Ton: sachlich, nicht alarmistisch.

Stichpunkte:
{{USER_NOTES}}

Falls unklar: schreibe "Daten unvollständig".`,
  geopoliticsImpact: `Analysiere die möglichen Marktauswirkungen folgender politischer Ereignisse (Indizes, Sektoren, Einzelaktien), Wahrscheinlichkeiten in % (subjektive Bandbreite), Zeithorizont (Tage/Wochen/Monate). KEINE Anlageberatung, nur Szenarien. 

Ereignisse:
{{USER_NOTES}}`,
  strongBuyScan: `Ich gebe dir eine Liste von Tickers samt (1) RSI 14 (2) MACD-Signal (3) Analysten-Strong-Buy-Anteil. Erzeuge eine tabellarische Shortlist nach Regel: (a) Analysten-Strong-Buy >= 30% (b) RSI zwischen 35-65 oder gerade aus Extremen kommend (c) MACD-Signal dreht positiv. Ergebnis mit knapper Begründung, ohne Imperativ, keine Anlageberatung.

Tickers:
{{TICKER_BLOCK}}`
};
