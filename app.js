// @author piercer
(() => {
  const KEY = "piercer_ai_playground_v1";
  const $ = (id) => document.getElementById(id);
  const IDS = ["sysPrompt", "userPrompt", "provA", "modelA", "provB", "modelB"];

  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    IDS.forEach((id) => { if (s[id] !== undefined) $(id).value = s[id]; });
  } catch {}

  function save() {
    const d = {};
    IDS.forEach((id) => { d[id] = $(id).value; });
    localStorage.setItem(KEY, JSON.stringify(d));
    const toks = Math.ceil(($("sysPrompt").value.length + $("userPrompt").value.length) / 4);
    $("tokenEst").textContent = `Tokens de entrada estimados: ~${toks} tokens (~$${(toks * 0.00000015).toFixed(6)})`;
  }

  async function callProvider(prov, model, key, sys, usr) {
    const t0 = performance.now();
    if (prov === "ollama") {
      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: sys }, { role: "user", content: usr }] }),
      });
      const d = await res.json();
      return { text: d?.message?.content || JSON.stringify(d), ms: Math.round(performance.now() - t0) };
    }
    if (prov === "gemini") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${sys}\n\n${usr}` }] }] }),
      });
      const d = await res.json();
      const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || d?.error?.message || JSON.stringify(d);
      return { text, ms: Math.round(performance.now() - t0) };
    }
    const url = prov === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, { role: "user", content: usr }] }),
    });
    const d = await res.json();
    const text = d?.choices?.[0]?.message?.content || d?.error?.message || JSON.stringify(d);
    return { text, ms: Math.round(performance.now() - t0) };
  }

  async function runOne(side) {
    const prov = $(`prov${side}`).value;
    const model = $(`model${side}`).value.trim();
    const key = $(`key${side}`).value.trim();
    if (prov !== "ollama" && !key) {
      $(`meta${side}`).textContent = "Informe a API Key";
      return;
    }
    $(`meta${side}`).textContent = "Executando...";
    try {
      const r = await callProvider(prov, model, key, $("sysPrompt").value, $("userPrompt").value);
      const outToks = Math.ceil(r.text.length / 4);
      $(`meta${side}`).textContent = `${r.ms} ms • ~${outToks} tokens saída`;
      $(`out${side}`).textContent = r.text;
    } catch (e) {
      $(`meta${side}`).textContent = "Erro";
      $(`out${side}`).textContent = e.message;
    }
  }

  $("btnRunAb").addEventListener("click", () => Promise.all([runOne("A"), runOne("B")]));
  IDS.forEach((id) => $(id).addEventListener("input", save));
  save();
})();
