/**
 * dashboard.js – Consulta Pública LDO 2026
 * Prefeitura Municipal de Oriximiná
 *
 * Visão geral completa:
 * - 8 cards de estatísticas gerais
 * - Gráficos de perfil: sexo, zona, perfil, faixa etária, bairros
 * - Prioridades mais votadas + ranking de necessidades
 * - Avaliações: radar + barras empilhadas + tabela detalhada
 * - Engajamento: participou / acha importante / quer receber info
 * - Últimas sugestões e observações textuais
 * - Filtros por bairro, zona, sexo e perfil
 * - Exportação CSV completa
 */

import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Estado ──────────────────────────────────────────────────
let todasRespostas = [];

// Instâncias dos gráficos (para destruir antes de recriar)
const charts = {};

// ─── Paletas ─────────────────────────────────────────────────
const COR_VERDE   = "rgba(26,107,60,0.85)";
const COR_AMARELO = "rgba(245,197,24,0.85)";
const PALETA_PIE  = [
  "#1a6b3c","#2d9e5f","#f5c518","#48bb78","#0f4226",
  "#fcd34d","#6ee7b7","#a7f3d0","#d4a800","#86efac",
];
const PALETA_AVAL = {
  pessimo: "#ef4444", ruim: "#f97316",
  regular: "#eab308", bom: "#22c55e", otimo: "#1a6b3c",
};

// ─── Mapeamentos ─────────────────────────────────────────────
const LABELS_PRI = {
  saude:"Saúde", educacao:"Educação", seguranca:"Segurança Pública",
  infraestrutura:"Infraestrutura", pavimentacao:"Pavimentação",
  iluminacao:"Iluminação Pública", limpeza:"Limpeza Urbana",
  saneamento:"Saneamento Básico", agua:"Abast. de Água",
  habitacao:"Habitação", meio_ambiente:"Meio Ambiente",
  agricultura:"Agricultura", emprego:"Emprego e Renda",
  turismo:"Turismo", cultura:"Cultura", esporte:"Esporte e Lazer",
  assistencia:"Assistência Social", transporte:"Transporte",
  mobilidade:"Mobilidade Urbana", inclusao_digital:"Inclusão Digital",
  juventude:"Juventude", mulher:"Atend. à Mulher",
  idosos:"Pol. para Idosos", pcd:"Pessoas c/ Defic.",
};

const AREAS_AVAL  = ["saude","educacao","limpeza","iluminacao","transporte","seguranca","infraestrutura","assistencia"];
const LABELS_AVAL = ["Saúde","Educação","Limpeza","Iluminação","Transporte","Segurança","Infraestrutura","Assist. Social"];
const NOTAS       = ["pessimo","ruim","regular","bom","otimo"];
const NOTAS_LABEL = ["Péssimo","Ruim","Regular","Bom","Ótimo"];
const AVAL_NUM    = { pessimo:1, ruim:2, regular:3, bom:4, otimo:5 };

// ─── Carga de dados ───────────────────────────────────────────
async function carregarDados() {
  mostrarLoading(true);
  try {
    const q    = query(collection(db, "respostasLDO"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    todasRespostas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    popularFiltros();
    renderizarDashboard(todasRespostas);
  } catch (err) {
    console.error("Erro ao carregar:", err);
    document.getElementById("areaLoading").innerHTML = `
      <div class="spinner-ldo">
        <span style="font-size:2rem">⚠️</span>
        <p>Erro ao carregar dados. Verifique a conexão e as regras do Firestore.</p>
      </div>`;
    return;
  }
  mostrarLoading(false);
}

// ─── Filtros ──────────────────────────────────────────────────
function popularFiltros() {
  const bairros = [...new Set(todasRespostas.map((r) => r.identificacao?.bairro).filter(Boolean))].sort();
  const zonas   = [...new Set(todasRespostas.map((r) => r.identificacao?.zona).filter(Boolean))].sort();
  const perfis  = [...new Set(todasRespostas.map((r) => r.perfil).filter(Boolean))].sort();

  preencherSelect("filtroBairro", bairros);
  preencherSelect("filtroZona",   zonas);
  preencherSelect("filtroPerfil", perfis);

  ["filtroBairro","filtroZona","filtroSexo","filtroPerfil"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", aplicarFiltros);
  });
}

function preencherSelect(id, valores) {
  const sel = document.getElementById(id);
  if (!sel) return;
  valores.forEach((v) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  });
}

function aplicarFiltros() {
  const bairro = document.getElementById("filtroBairro").value;
  const zona   = document.getElementById("filtroZona").value;
  const sexo   = document.getElementById("filtroSexo").value;
  const perfil = document.getElementById("filtroPerfil").value;
  let dados = todasRespostas;
  if (bairro) dados = dados.filter((r) => r.identificacao?.bairro === bairro);
  if (zona)   dados = dados.filter((r) => r.identificacao?.zona   === zona);
  if (sexo)   dados = dados.filter((r) => r.identificacao?.sexo   === sexo);
  if (perfil) dados = dados.filter((r) => r.perfil                === perfil);
  renderizarDashboard(dados);
}

// ─── Orquestrador ────────────────────────────────────────────
function renderizarDashboard(dados) {
  renderizarStats(dados);
  renderizarSexo(dados);
  renderizarZona(dados);
  renderizarPerfil(dados);
  renderizarIdade(dados);
  renderizarBairros(dados);
  renderizarPrioridades(dados);
  renderizarNecessidades(dados);
  renderizarAvaliacoesRadar(dados);
  renderizarAvaliacoesBarras(dados);
  renderizarTabelaAvaliacoes(dados);
  renderizarEngajamento(dados);
  renderizarSugestoes(dados);
  renderizarObservacoes(dados);
}

// ══════════════════════════════════════════════════════════════
// BLOCO 1 – ESTATÍSTICAS GERAIS
// ══════════════════════════════════════════════════════════════
function renderizarStats(dados) {
  const total = dados.length;
  set("statTotal", total);

  const bairros = new Set(dados.map((r) => r.identificacao?.bairro).filter(Boolean));
  set("statBairros", bairros.size);

  // Média geral de avaliações
  let soma = 0, cnt = 0;
  dados.forEach((r) => {
    AREAS_AVAL.forEach((a) => {
      const v = AVAL_NUM[r.avaliacoes?.[a]];
      if (v) { soma += v; cnt++; }
    });
  });
  set("statMedia", cnt ? (soma / cnt).toFixed(1) : "–");

  // Idade média
  const idades = dados.map((r) => Number(r.identificacao?.idade)).filter((v) => v > 0 && v < 120);
  const idadeMedia = idades.length ? Math.round(idades.reduce((a, b) => a + b, 0) / idades.length) : "–";
  set("statIdadeMedia", idadeMedia !== "–" ? `${idadeMedia} anos` : "–");

  // Zona mais frequente
  set("statZona", topKey(dados.map((r) => r.identificacao?.zona)) || "–");

  // Perfil mais frequente
  set("statPerfil", topKey(dados.map((r) => r.perfil)) || "–");

  // Já participou: conta "Sim"
  const jaParticipou = dados.filter((r) => r.participacao?.participou === "Sim").length;
  set("statJaParticipou", total ? `${jaParticipou} (${pct(jaParticipou, total)}%)` : "–");

  // Acha importante: conta "Sim"
  const acharImportante = dados.filter((r) => r.participacao?.importante === "Sim").length;
  set("statAchaImportante", total ? `${acharImportante} (${pct(acharImportante, total)}%)` : "–");
}

// ══════════════════════════════════════════════════════════════
// BLOCO 2 – PERFIL DOS PARTICIPANTES
// ══════════════════════════════════════════════════════════════
function renderizarSexo(dados) {
  const cont = contarCampo(dados.map((r) => r.identificacao?.sexo));
  renderPie("chartSexo", cont, PALETA_PIE);
}

function renderizarZona(dados) {
  const cont = contarCampo(dados.map((r) => r.identificacao?.zona));
  renderPie("chartZona", cont, PALETA_PIE);
}

function renderizarPerfil(dados) {
  // simplifica "Outro: XYZ" → "Outro"
  const cont = contarCampo(dados.map((r) => r.perfil?.startsWith("Outro") ? "Outro" : r.perfil));
  renderPie("chartPerfil", cont, PALETA_PIE);
}

function renderizarIdade(dados) {
  const faixas = { "< 18": 0, "18–29": 0, "30–44": 0, "45–59": 0, "60+": 0, "N/I": 0 };
  dados.forEach((r) => {
    const v = Number(r.identificacao?.idade);
    if (!v || v < 1 || v > 120) { faixas["N/I"]++; return; }
    if (v < 18)       faixas["< 18"]++;
    else if (v <= 29) faixas["18–29"]++;
    else if (v <= 44) faixas["30–44"]++;
    else if (v <= 59) faixas["45–59"]++;
    else              faixas["60+"]++;
  });

  const labels = Object.keys(faixas).filter((k) => faixas[k] > 0);
  const values = labels.map((k) => faixas[k]);

  const ctx = getCtx("chartIdade");
  if (!ctx) return;
  destruir("chartIdade");
  charts["chartIdade"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Participantes",
        data: values,
        backgroundColor: COR_VERDE,
        hoverBackgroundColor: "rgba(26,107,60,1)",
        borderRadius: 7,
        borderSkipped: false,
      }],
    },
    options: opcoesBar("Participantes"),
  });
}

function renderizarBairros(dados) {
  const cont = {};
  dados.forEach((r) => {
    const b = r.identificacao?.bairro?.trim();
    if (b) cont[b] = (cont[b] || 0) + 1;
  });
  const ordenado = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max      = ordenado[0]?.[1] || 1;

  const el = document.getElementById("rankingBairros");
  if (!el) return;
  if (!ordenado.length) { el.innerHTML = "<p class='text-muted small'>Nenhum dado.</p>"; return; }

  el.innerHTML = ordenado.map(([nome, cnt], i) => `
    <div class="ranking-item">
      <span class="rank-pos ${i===0?"top1":i===1?"top2":i===2?"top3":""}">${i+1}</span>
      <span class="rank-nome">${nome}</span>
      <div class="rank-bar"><div class="rank-bar-fill" style="width:${(cnt/max)*100}%"></div></div>
      <span class="rank-count">${cnt}x</span>
    </div>
  `).join("");
}

// ══════════════════════════════════════════════════════════════
// BLOCO 3 – PRIORIDADES E NECESSIDADES
// ══════════════════════════════════════════════════════════════
function renderizarPrioridades(dados) {
  const cont = {};
  dados.forEach((r) => {
    (r.prioridades || []).forEach((p) => {
      const k = p.startsWith("Outro:") ? "outro" : p;
      cont[k] = (cont[k] || 0) + 1;
    });
  });
  const ordenado = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const labels   = ordenado.map(([k]) => LABELS_PRI[k] || k);
  const values   = ordenado.map(([, v]) => v);

  const ctx = getCtx("chartPrioridades");
  if (!ctx) return;
  destruir("chartPrioridades");
  charts["chartPrioridades"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Votos",
        data: values,
        backgroundColor: COR_VERDE,
        hoverBackgroundColor: "rgba(26,107,60,1)",
        borderRadius: 7,
        borderSkipped: false,
      }],
    },
    options: opcoesBar("Votos"),
  });
}

function renderizarNecessidades(dados) {
  const cont = {};
  dados.forEach((r) => {
    (r.necessidades || []).forEach((n) => {
      const k = n.trim().toLowerCase();
      if (k) cont[k] = (cont[k] || 0) + 1;
    });
  });
  const ordenado  = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const container = document.getElementById("rankingNecessidades");
  if (!container) return;

  if (!ordenado.length) {
    container.innerHTML = "<p class='text-muted small'>Nenhuma necessidade registrada.</p>";
    return;
  }
  const max = ordenado[0][1];
  container.innerHTML = ordenado.map(([nome, cnt], i) => `
    <div class="ranking-item">
      <span class="rank-pos ${i===0?"top1":i===1?"top2":i===2?"top3":""}">${i+1}</span>
      <span class="rank-nome">${capitalize(nome)}</span>
      <div class="rank-bar"><div class="rank-bar-fill" style="width:${(cnt/max)*100}%"></div></div>
      <span class="rank-count">${cnt}x</span>
    </div>
  `).join("");
}

// ══════════════════════════════════════════════════════════════
// BLOCO 4 – AVALIAÇÕES
// ══════════════════════════════════════════════════════════════
function renderizarAvaliacoesRadar(dados) {
  const medias = AREAS_AVAL.map((a) => media(dados.map((r) => AVAL_NUM[r.avaliacoes?.[a]])));

  const ctx = getCtx("chartAvaliacoes");
  if (!ctx) return;
  destruir("chartAvaliacoes");
  charts["chartAvaliacoes"] = new Chart(ctx, {
    type: "radar",
    data: {
      labels: LABELS_AVAL,
      datasets: [{
        label: "Média (1–5)",
        data: medias,
        backgroundColor: "rgba(26,107,60,0.12)",
        borderColor: "#1a6b3c",
        borderWidth: 2,
        pointBackgroundColor: "#1a6b3c",
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true,
      scales: {
        r: {
          min: 0, max: 5,
          ticks: { stepSize: 1, font: { size: 9 } },
          pointLabels: { font: { size: 10 } },
          grid: { color: "#e5e7eb" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` Média: ${c.raw}` } },
      },
    },
  });
}

function renderizarAvaliacoesBarras(dados) {
  // Barras empilhadas: cada serviço × distribuição de notas
  const datasets = NOTAS.map((nota, i) => ({
    label: NOTAS_LABEL[i],
    data: AREAS_AVAL.map((a) =>
      dados.filter((r) => r.avaliacoes?.[a] === nota).length
    ),
    backgroundColor: Object.values(PALETA_AVAL)[i],
    borderRadius: 4,
  }));

  const ctx = getCtx("chartAvaliacoesBarras");
  if (!ctx) return;
  destruir("chartAvaliacoesBarras");
  charts["chartAvaliacoesBarras"] = new Chart(ctx, {
    type: "bar",
    data: { labels: LABELS_AVAL, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 14 } },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "#f3f4f6" } },
      },
    },
  });
}

function renderizarTabelaAvaliacoes(dados) {
  const el = document.getElementById("tabelaAvaliacoes");
  if (!el) return;
  if (!dados.length) { el.innerHTML = "<p class='text-muted small'>Sem dados.</p>"; return; }

  const linhas = AREAS_AVAL.map((a, idx) => {
    const contNota = {};
    NOTAS.forEach((n) => { contNota[n] = 0; });
    dados.forEach((r) => { const n = r.avaliacoes?.[a]; if (n) contNota[n]++; });
    const total    = Object.values(contNota).reduce((s, v) => s + v, 0);
    const med      = media(dados.map((r) => AVAL_NUM[r.avaliacoes?.[a]]));
    const estrelas = med > 0 ? "★".repeat(Math.round(med)) + "☆".repeat(5 - Math.round(med)) : "–";

    return `
      <tr>
        <td class="fw-semibold">${LABELS_AVAL[idx]}</td>
        ${NOTAS.map((n) => `
          <td class="text-center">
            ${contNota[n]}
            ${total > 0 ? `<small class="text-muted">(${pct(contNota[n], total)}%)</small>` : ""}
          </td>
        `).join("")}
        <td class="text-center fw-bold" style="color:var(--verde)">${med > 0 ? med.toFixed(1) : "–"}</td>
        <td class="text-center" style="color:#eab308; letter-spacing:-2px">${estrelas}</td>
      </tr>
    `;
  });

  el.innerHTML = `
    <table class="table table-sm table-hover" style="font-size:.85rem">
      <thead style="background:var(--verde-palido)">
        <tr>
          <th>Serviço</th>
          <th class="text-center" style="color:#ef4444">Péssimo</th>
          <th class="text-center" style="color:#f97316">Ruim</th>
          <th class="text-center" style="color:#eab308">Regular</th>
          <th class="text-center" style="color:#22c55e">Bom</th>
          <th class="text-center" style="color:#1a6b3c">Ótimo</th>
          <th class="text-center">Média</th>
          <th class="text-center">Nota</th>
        </tr>
      </thead>
      <tbody>${linhas.join("")}</tbody>
    </table>
  `;
}

// ══════════════════════════════════════════════════════════════
// BLOCO 5 – ENGAJAMENTO
// ══════════════════════════════════════════════════════════════
function renderizarEngajamento(dados) {
  renderDoughnut("chartParticipou",
    contarCampo(dados.map((r) => r.participacao?.participou)),
    ["#1a6b3c","#ef4444","#94a3b8"]
  );
  renderDoughnut("chartImportante",
    contarCampo(dados.map((r) => r.participacao?.importante)),
    ["#1a6b3c","#ef4444","#eab308"]
  );
  renderDoughnut("chartReceberInfo",
    contarCampo(dados.map((r) => r.participacao?.receberInfo)),
    ["#1a6b3c","#ef4444","#94a3b8"]
  );
}

// ══════════════════════════════════════════════════════════════
// BLOCO 6 – SUGESTÕES E OBSERVAÇÕES
// ══════════════════════════════════════════════════════════════
function renderizarSugestoes(dados) {
  const itens = dados
    .filter((r) => r.sugestoes?.trim())
    .slice(0, 10);
  const el = document.getElementById("listaSugestoes");
  if (!el) return;
  if (!itens.length) { el.innerHTML = "<p class='text-muted small'>Nenhuma sugestão registrada.</p>"; return; }
  el.innerHTML = itens.map((r) => `
    <div class="sugestao-item">
      <div class="sugestao-autor">
        <i class="bi bi-person-circle me-1"></i>
        ${r.identificacao?.nome || "Anônimo"} · ${r.identificacao?.bairro || "–"}
      </div>
      <div class="sugestao-texto">${escapeHtml(r.sugestoes)}</div>
    </div>
  `).join("");
}

function renderizarObservacoes(dados) {
  const itens = dados
    .filter((r) => r.observacoes?.trim())
    .slice(0, 10);
  const el = document.getElementById("listaObservacoes");
  if (!el) return;
  if (!itens.length) { el.innerHTML = "<p class='text-muted small'>Nenhuma observação registrada.</p>"; return; }
  el.innerHTML = itens.map((r) => `
    <div class="sugestao-item">
      <div class="sugestao-autor">
        <i class="bi bi-person-circle me-1"></i>
        ${r.identificacao?.nome || "Anônimo"} · ${r.identificacao?.bairro || "–"}
      </div>
      <div class="sugestao-texto">${escapeHtml(r.observacoes)}</div>
    </div>
  `).join("");
}

// ══════════════════════════════════════════════════════════════
// EXPORTAÇÃO PDF – captura todos os gráficos e tabelas
// ══════════════════════════════════════════════════════════════
document.getElementById("btnExportar")?.addEventListener("click", async () => {
  const btnIcone   = document.getElementById("btnExportarIcone");
  const btnLoading = document.getElementById("btnExportarLoading");
  const btn        = document.getElementById("btnExportar");

  // Estado de loading
  btn.disabled       = true;
  btnIcone.style.display   = "none";
  btnLoading.style.display = "inline-flex";

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const LARGURA  = 210;  // A4 largura mm
    const ALTURA   = 297;  // A4 altura mm
    const MARGEM   = 12;   // margem lateral mm
    const CONTEUDO = LARGURA - MARGEM * 2;

    let y = 0; // cursor vertical

    // ── helpers ────────────────────────────────────────────────
    const novaP = () => { pdf.addPage(); y = MARGEM; };

    const cabecalhoP = (titulo, num) => {
      // faixa verde no topo
      pdf.setFillColor(15, 66, 38);
      pdf.rect(0, 0, LARGURA, 16, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Prefeitura Municipal de Oriximiná  ·  Consulta Pública LDO 2026", MARGEM, 10);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Página ${num}`, LARGURA - MARGEM, 10, { align: "right" });
      y = 22;
      if (titulo) {
        pdf.setFillColor(232, 245, 238);
        pdf.rect(MARGEM, y, CONTEUDO, 8, "F");
        pdf.setTextColor(15, 66, 38);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(titulo, MARGEM + 3, y + 5.5);
        y += 12;
      }
      pdf.setTextColor(31, 41, 55);
    };

    const secaoTitulo = (texto) => {
      if (y > ALTURA - 30) { novaP(); cabecalhoP("", ++pagina); }
      pdf.setFillColor(232, 245, 238);
      pdf.rect(MARGEM, y, CONTEUDO, 7, "F");
      pdf.setDrawColor(26, 107, 60);
      pdf.rect(MARGEM, y, 3, 7, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(15, 66, 38);
      pdf.text(texto.toUpperCase(), MARGEM + 5, y + 5);
      pdf.setTextColor(31, 41, 55);
      y += 10;
    };

    // captura um elemento canvas/div como imagem e insere no PDF
    const inserirCanvas = async (elementId, altMm = 60, label = "") => {
      const el = document.getElementById(elementId);
      if (!el) return;
      if (label) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(26, 107, 60);
        pdf.text(label, MARGEM, y);
        pdf.setTextColor(31, 41, 55);
        y += 5;
      }
      if (y + altMm > ALTURA - 10) { novaP(); cabecalhoP("", ++pagina); }
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const ratio   = canvas.width / canvas.height;
      const w = CONTEUDO;
      const h = Math.min(w / ratio, altMm);
      pdf.addImage(imgData, "PNG", MARGEM, y, w, h);
      y += h + 5;
    };

    // captura dois elementos lado a lado (col 50/50)
    const inserirDoisCanvasSideBySide = async (id1, id2, label1, label2, altMm = 55) => {
      if (y + altMm > ALTURA - 10) { novaP(); cabecalhoP("", ++pagina); }
      const metade = (CONTEUDO - 4) / 2;
      for (const [id, label, x] of [[id1, label1, MARGEM], [id2, label2, MARGEM + metade + 4]]) {
        const el = document.getElementById(id);
        if (!el) continue;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(26, 107, 60);
        pdf.text(label, x, y);
        pdf.setTextColor(31, 41, 55);
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL("image/png");
        const ratio   = canvas.width / canvas.height;
        const h = Math.min(metade / ratio, altMm);
        pdf.addImage(imgData, "PNG", x, y + 5, metade, h);
      }
      y += altMm + 8;
    };

    const inserirRanking = (containerId, label) => {
      const el = document.getElementById(containerId);
      if (!el) return;
      if (label) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(26, 107, 60);
        pdf.text(label, MARGEM, y);
        pdf.setTextColor(31, 41, 55);
        y += 5;
      }
      const itens = el.querySelectorAll(".ranking-item");
      itens.forEach((item) => {
        if (y > ALTURA - 15) { novaP(); cabecalhoP("", ++pagina); }
        const pos  = item.querySelector(".rank-pos")?.textContent?.trim() || "";
        const nome = item.querySelector(".rank-nome")?.textContent?.trim() || "";
        const cnt  = item.querySelector(".rank-count")?.textContent?.trim() || "";
        const fill = item.querySelector(".rank-bar-fill");
        const pctW = fill ? parseFloat(fill.style.width) / 100 : 0;

        // número
        pdf.setFillColor(232, 245, 238);
        pdf.circle(MARGEM + 3, y + 2, 2.5, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(15, 66, 38);
        pdf.text(pos, MARGEM + 3, y + 2.8, { align: "center" });

        // nome
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(31, 41, 55);
        pdf.text(nome, MARGEM + 8, y + 3);

        // barra
        const barX = MARGEM + 80;
        const barW = CONTEUDO - 80 - 18;
        pdf.setFillColor(229, 231, 235);
        pdf.roundedRect(barX, y, barW, 3.5, 1, 1, "F");
        if (pctW > 0) {
          pdf.setFillColor(26, 107, 60);
          pdf.roundedRect(barX, y, barW * pctW, 3.5, 1, 1, "F");
        }

        // contagem
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(107, 114, 128);
        pdf.text(cnt, LARGURA - MARGEM, y + 3, { align: "right" });

        pdf.setTextColor(31, 41, 55);
        y += 7;
      });
      y += 3;
    };

    const inserirSugestoes = (containerId, label) => {
      const el = document.getElementById(containerId);
      if (!el) return;
      if (label) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(26, 107, 60);
        pdf.text(label, MARGEM, y);
        pdf.setTextColor(31, 41, 55);
        y += 5;
      }
      const itens = el.querySelectorAll(".sugestao-item");
      itens.forEach((item) => {
        if (y > ALTURA - 20) { novaP(); cabecalhoP("", ++pagina); }
        const autor = item.querySelector(".sugestao-autor")?.textContent?.trim() || "";
        const texto = item.querySelector(".sugestao-texto")?.textContent?.trim() || "";
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(26, 107, 60);
        pdf.text(autor, MARGEM, y);
        y += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(31, 41, 55);
        const linhas = pdf.splitTextToSize(texto, CONTEUDO);
        linhas.forEach((l) => {
          if (y > ALTURA - 10) { novaP(); cabecalhoP("", ++pagina); }
          pdf.text(l, MARGEM, y);
          y += 4;
        });
        pdf.setDrawColor(229, 231, 235);
        pdf.line(MARGEM, y, LARGURA - MARGEM, y);
        y += 4;
      });
    };

    // ── CAPA ──────────────────────────────────────────────────
    let pagina = 1;
    pdf.setFillColor(15, 66, 38);
    pdf.rect(0, 0, LARGURA, 60, "F");
    pdf.setFillColor(245, 197, 24);
    pdf.rect(0, 58, LARGURA, 3, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("Consulta Pública LDO 2026", LARGURA / 2, 28, { align: "center" });
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text("Prefeitura Municipal de Oriximiná", LARGURA / 2, 38, { align: "center" });
    pdf.setFontSize(9);
    pdf.text("Relatório de Resultados – Participação Popular", LARGURA / 2, 46, { align: "center" });

    // filtros ativos na capa
    const filtroAtivo = [
      document.getElementById("filtroBairro").value && `Bairro: ${document.getElementById("filtroBairro").value}`,
      document.getElementById("filtroZona").value   && `Zona: ${document.getElementById("filtroZona").value}`,
      document.getElementById("filtroSexo").value   && `Sexo: ${document.getElementById("filtroSexo").value}`,
      document.getElementById("filtroPerfil").value && `Perfil: ${document.getElementById("filtroPerfil").value}`,
    ].filter(Boolean).join("  ·  ");

    y = 70;
    pdf.setTextColor(31, 41, 55);

    if (filtroAtivo) {
      pdf.setFillColor(255, 251, 235);
      pdf.roundedRect(MARGEM, y, CONTEUDO, 10, 2, 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(120, 53, 15);
      pdf.text(`⚠ Filtros ativos: ${filtroAtivo}`, MARGEM + 3, y + 6.5);
      pdf.setTextColor(31, 41, 55);
      y += 15;
    }

    // Cards de estatísticas gerais na capa
    const statsIds = [
      ["statTotal","Total de Respostas"],["statBairros","Bairros Participantes"],
      ["statMedia","Média das Avaliações"],["statIdadeMedia","Idade Média"],
      ["statZona","Zona Mais Ativa"],["statPerfil","Perfil Mais Frequente"],
      ["statJaParticipou","Participaram Antes"],["statAchaImportante","Acham Importante"],
    ];
    const colW = (CONTEUDO - 6) / 4;
    statsIds.forEach(([id, label], i) => {
      const col = i % 4;
      const lin = Math.floor(i / 4);
      const cx  = MARGEM + col * (colW + 2);
      const cy  = y + lin * 22;
      pdf.setFillColor(232, 245, 238);
      pdf.roundedRect(cx, cy, colW, 18, 2, 2, "F");
      pdf.setDrawColor(26, 107, 60);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(cx, cy, colW, 18, 2, 2, "S");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(15, 66, 38);
      pdf.text(document.getElementById(id)?.textContent || "–", cx + colW / 2, cy + 8, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(107, 114, 128);
      pdf.text(label, cx + colW / 2, cy + 14, { align: "center" });
      pdf.setTextColor(31, 41, 55);
    });
    y += 50;

    // data de geração
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")}  ·  Dados via Firebase Firestore`,
      LARGURA / 2, ALTURA - 10, { align: "center" }
    );

    // ── PÁGINA 2 – PERFIL DOS PARTICIPANTES ──────────────────
    pdf.addPage(); pagina++;
    cabecalhoP("Perfil dos Participantes", pagina);

    await inserirDoisCanvasSideBySide(
      "chartSexo",  "chartZona",
      "Distribuição por Sexo", "Participação por Zona", 60
    );
    await inserirCanvas("chartPerfil", 65, "Perfil do Participante");
    await inserirCanvas("chartIdade",  55, "Faixa Etária");

    // ── PÁGINA 3 – BAIRROS + PRIORIDADES ─────────────────────
    pdf.addPage(); pagina++;
    cabecalhoP("Bairros e Prioridades", pagina);

    inserirRanking("rankingBairros", "Bairros com Mais Participações");
    secaoTitulo("Prioridades Mais Votadas");
    await inserirCanvas("chartPrioridades", 80);

    // ── PÁGINA 4 – NECESSIDADES ───────────────────────────────
    pdf.addPage(); pagina++;
    cabecalhoP("Necessidades e Demandas", pagina);
    inserirRanking("rankingNecessidades", "Ranking de Necessidades Relatadas");

    // ── PÁGINA 5 – AVALIAÇÕES ─────────────────────────────────
    pdf.addPage(); pagina++;
    cabecalhoP("Avaliação dos Serviços Públicos", pagina);

    await inserirDoisCanvasSideBySide(
      "chartAvaliacoes", "chartAvaliacoesBarras",
      "Radar de Avaliação (média 1–5)", "Distribuição de Notas por Serviço", 72
    );

    // tabela de avaliações
    secaoTitulo("Detalhamento das Avaliações");
    await inserirCanvas("tabelaAvaliacoes", 55);

    // ── PÁGINA 6 – ENGAJAMENTO ────────────────────────────────
    pdf.addPage(); pagina++;
    cabecalhoP("Engajamento e Participação", pagina);

    await inserirDoisCanvasSideBySide(
      "chartParticipou", "chartImportante",
      "Já participou de audiências?", "Acha importante participar?", 65
    );
    await inserirCanvas("chartReceberInfo", 65, "Quer receber informações?");

    // ── PÁGINA 7 – SUGESTÕES E OBSERVAÇÕES ───────────────────
    pdf.addPage(); pagina++;
    cabecalhoP("Sugestões e Observações", pagina);

    inserirSugestoes("listaSugestoes", "Sugestões de Obras / Ações");
    if (y < ALTURA - 40) {
      secaoTitulo("Observações Finais");
      inserirSugestoes("listaObservacoes", "");
    } else {
      pdf.addPage(); pagina++;
      cabecalhoP("Observações Finais", pagina);
      inserirSugestoes("listaObservacoes", "");
    }

    // ── Salva ─────────────────────────────────────────────────
    const nomeArq = `ldo_oriximina_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(nomeArq);

  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    alert("❌ Erro ao gerar o PDF. Verifique o console para detalhes.");
  } finally {
    btn.disabled             = false;
    btnIcone.style.display   = "inline";
    btnLoading.style.display = "none";
  }
});

// ══════════════════════════════════════════════════════════════
// HELPERS DE GRÁFICO
// ══════════════════════════════════════════════════════════════
function renderPie(id, cont, cores) {
  const ctx = getCtx(id);
  if (!ctx) return;
  destruir(id);
  const labels = Object.keys(cont);
  const values = Object.values(cont);
  charts[id] = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: cores.slice(0, labels.length),
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 14, padding: 8 } },
        tooltip: {
          callbacks: {
            label: (c) => {
              const total = c.dataset.data.reduce((a, b) => a + b, 0);
              return ` ${c.label}: ${c.raw} (${pct(c.raw, total)}%)`;
            },
          },
        },
      },
    },
  });
}

function renderDoughnut(id, cont, cores) {
  const ctx = getCtx(id);
  if (!ctx) return;
  destruir(id);
  const labels = Object.keys(cont);
  const values = Object.values(cont);
  charts[id] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: cores.slice(0, labels.length),
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      cutout: "55%",
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 14, padding: 8 } },
        tooltip: {
          callbacks: {
            label: (c) => {
              const total = c.dataset.data.reduce((a, b) => a + b, 0);
              return ` ${c.label}: ${c.raw} (${pct(c.raw, total)}%)`;
            },
          },
        },
      },
    },
  });
}

function opcoesBar(label) {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => ` ${c.raw} ${label.toLowerCase()}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "#f3f4f6" } },
    },
  };
}

// ══════════════════════════════════════════════════════════════
// HELPERS GERAIS
// ══════════════════════════════════════════════════════════════
function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function getCtx(id) {
  return document.getElementById(id)?.getContext("2d") || null;
}
function destruir(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}
function contarCampo(arr) {
  const cont = {};
  arr.filter(Boolean).forEach((v) => { cont[v] = (cont[v] || 0) + 1; });
  return cont;
}
function topKey(arr) {
  const cont = contarCampo(arr);
  const top  = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}
function media(arr) {
  const v = arr.filter(Boolean);
  return v.length ? parseFloat((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)) : 0;
}
function pct(val, total) {
  return total > 0 ? Math.round((val / total) * 100) : 0;
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Botão atualizar ─────────────────────────────────────────
document.getElementById("btnAtualizar")?.addEventListener("click", carregarDados);

// ─── Loading ─────────────────────────────────────────────────
function mostrarLoading(show) {
  const loading  = document.getElementById("areaLoading");
  const conteudo = document.getElementById("areaConteudo");
  if (loading)  loading.style.display  = show ? "flex" : "none";
  if (conteudo) conteudo.style.display = show ? "none"  : "block";
}

// ─── Inicializa ───────────────────────────────────────────────
carregarDados();