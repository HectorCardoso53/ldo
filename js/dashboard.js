/**
 * dashboard.js – Consulta Pública LDO 2026
 * Prefeitura Municipal de Oriximiná
 *
 * - Busca dados do Firestore em tempo real
 * - Filtros por bairro e zona
 * - Gráfico de barras: prioridades mais votadas
 * - Gráfico radar: avaliação média das 8 áreas
 * - Ranking de necessidades
 * - Distribuição por zona
 * - Exportação CSV
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
let chartPrioridades = null;
let chartAvaliacoes  = null;

// ─── Labels amigáveis para prioridades ───────────────────────
const LABELS_PRI = {
  saude:           "Saúde",
  educacao:        "Educação",
  seguranca:       "Segurança Pública",
  infraestrutura:  "Infraestrutura",
  pavimentacao:    "Pavimentação",
  iluminacao:      "Iluminação Pública",
  limpeza:         "Limpeza Urbana",
  saneamento:      "Saneamento Básico",
  agua:            "Abast. de Água",
  habitacao:       "Habitação",
  meio_ambiente:   "Meio Ambiente",
  agricultura:     "Agricultura",
  emprego:         "Emprego e Renda",
  turismo:         "Turismo",
  cultura:         "Cultura",
  esporte:         "Esporte e Lazer",
  assistencia:     "Assistência Social",
  transporte:      "Transporte",
  mobilidade:      "Mobilidade Urbana",
  inclusao_digital:"Inclusão Digital",
  juventude:       "Juventude",
  mulher:          "Atend. à Mulher",
  idosos:          "Pol. para Idosos",
  pcd:             "Pessoas c/ Defic.",
};

// Áreas de avaliação (8 áreas conforme formulário)
const AREAS_AVAL  = ["saude","educacao","limpeza","iluminacao","transporte","seguranca","infraestrutura","assistencia"];
const LABELS_AVAL = ["Saúde","Educação","Limpeza","Iluminação","Transporte","Segurança","Infra.","Assist. Social"];
const AVAL_NUM    = { pessimo: 1, ruim: 2, regular: 3, bom: 4, otimo: 5 };

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
  const bairros = [...new Set(
    todasRespostas.map((r) => r.identificacao?.bairro).filter(Boolean)
  )].sort();
  const zonas = [...new Set(
    todasRespostas.map((r) => r.identificacao?.zona).filter(Boolean)
  )].sort();

  const selB = document.getElementById("filtroBairro");
  const selZ = document.getElementById("filtroZona");

  bairros.forEach((b) => {
    const o = document.createElement("option");
    o.value = b; o.textContent = b;
    selB.appendChild(o);
  });
  zonas.forEach((z) => {
    const o = document.createElement("option");
    o.value = z; o.textContent = z;
    selZ.appendChild(o);
  });

  selB.addEventListener("change", aplicarFiltros);
  selZ.addEventListener("change", aplicarFiltros);
}

function aplicarFiltros() {
  const bairro = document.getElementById("filtroBairro").value;
  const zona   = document.getElementById("filtroZona").value;
  let dados    = todasRespostas;
  if (bairro) dados = dados.filter((r) => r.identificacao?.bairro === bairro);
  if (zona)   dados = dados.filter((r) => r.identificacao?.zona   === zona);
  renderizarDashboard(dados);
}

// ─── Renderização geral ───────────────────────────────────────
function renderizarDashboard(dados) {
  renderizarStats(dados);
  renderizarGraficoPrioridades(dados);
  renderizarGraficoAvaliacoes(dados);
  renderizarRankingNecessidades(dados);
  renderizarDistribuicaoZona(dados);
}

// ─── Stats ────────────────────────────────────────────────────
function renderizarStats(dados) {
  document.getElementById("statTotal").textContent = dados.length;

  const bairros = new Set(dados.map((r) => r.identificacao?.bairro).filter(Boolean));
  document.getElementById("statBairros").textContent = bairros.size;

  // Média geral de todas as avaliações
  let soma = 0, cnt = 0;
  dados.forEach((r) => {
    AREAS_AVAL.forEach((a) => {
      const v = AVAL_NUM[r.avaliacoes?.[a]];
      if (v) { soma += v; cnt++; }
    });
  });
  document.getElementById("statMedia").textContent = cnt ? (soma / cnt).toFixed(1) : "–";

  // Zona mais frequente
  const contZ = {};
  dados.forEach((r) => {
    const z = r.identificacao?.zona;
    if (z) contZ[z] = (contZ[z] || 0) + 1;
  });
  const topZ = Object.entries(contZ).sort((a, b) => b[1] - a[1])[0];
  document.getElementById("statZona").textContent = topZ ? topZ[0] : "–";
}

// ─── Gráfico barras – Prioridades ────────────────────────────
function renderizarGraficoPrioridades(dados) {
  const cont = {};
  dados.forEach((r) => {
    (r.prioridades || []).forEach((p) => {
      // normaliza valores como "Outro: XYZ" → "outro"
      const chave = p.startsWith("Outro:") ? "outro" : p;
      cont[chave] = (cont[chave] || 0) + 1;
    });
  });

  const ordenado = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const labels   = ordenado.map(([k]) => LABELS_PRI[k] || k);
  const valores  = ordenado.map(([, v]) => v);

  const ctx = document.getElementById("chartPrioridades").getContext("2d");
  if (chartPrioridades) chartPrioridades.destroy();

  chartPrioridades = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Votos",
        data: valores,
        backgroundColor: "rgba(26,107,60,0.80)",
        hoverBackgroundColor: "rgba(26,107,60,1)",
        borderRadius: 7,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.raw} voto${c.raw !== 1 ? "s" : ""}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "#f3f4f6" } },
      },
    },
  });
}

// ─── Gráfico radar – Avaliações ──────────────────────────────
function renderizarGraficoAvaliacoes(dados) {
  const medias = AREAS_AVAL.map((a) => {
    let soma = 0, cnt = 0;
    dados.forEach((r) => {
      const v = AVAL_NUM[r.avaliacoes?.[a]];
      if (v) { soma += v; cnt++; }
    });
    return cnt ? parseFloat((soma / cnt).toFixed(2)) : 0;
  });

  const ctx = document.getElementById("chartAvaliacoes").getContext("2d");
  if (chartAvaliacoes) chartAvaliacoes.destroy();

  chartAvaliacoes = new Chart(ctx, {
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
          pointLabels: { font: { size: 11 } },
          grid: { color: "#e5e7eb" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` Média: ${c.raw}` } },
      },
    },
  });

  // Tabela de médias
  const tabela = document.getElementById("tabelaMedias");
  if (tabela) {
    tabela.innerHTML = LABELS_AVAL.map((nome, i) => `
      <div class="ranking-item">
        <span class="rank-nome">${nome}</span>
        <div class="rank-bar">
          <div class="rank-bar-fill" style="width:${(medias[i] / 5) * 100}%"></div>
        </div>
        <span class="rank-count">${medias[i].toFixed(1)}/5</span>
      </div>
    `).join("");
  }
}

// ─── Ranking necessidades ────────────────────────────────────
function renderizarRankingNecessidades(dados) {
  const cont = {};
  dados.forEach((r) => {
    (r.necessidades || []).forEach((n) => {
      const k = n.trim().toLowerCase();
      if (k) cont[k] = (cont[k] || 0) + 1;
    });
  });

  const ordenado  = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const container = document.getElementById("rankingNecessidades");

  if (!ordenado.length) {
    container.innerHTML = '<p class="text-muted small">Nenhuma necessidade registrada.</p>';
    return;
  }
  const max = ordenado[0][1];
  container.innerHTML = ordenado.map(([nome, cnt], i) => `
    <div class="ranking-item">
      <span class="rank-pos ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}">${i + 1}</span>
      <span class="rank-nome">${nome.charAt(0).toUpperCase() + nome.slice(1)}</span>
      <div class="rank-bar"><div class="rank-bar-fill" style="width:${(cnt / max) * 100}%"></div></div>
      <span class="rank-count">${cnt}x</span>
    </div>
  `).join("");
}

// ─── Distribuição por zona ────────────────────────────────────
function renderizarDistribuicaoZona(dados) {
  const cont = {};
  dados.forEach((r) => {
    const z = r.identificacao?.zona || "Não informado";
    cont[z] = (cont[z] || 0) + 1;
  });
  const total     = dados.length || 1;
  const container = document.getElementById("distribuicaoZona");
  if (!container) return;
  container.innerHTML = Object.entries(cont)
    .sort((a, b) => b[1] - a[1])
    .map(([zona, cnt]) => `
      <div class="ranking-item">
        <span class="rank-nome">${zona}</span>
        <div class="rank-bar"><div class="rank-bar-fill" style="width:${(cnt / total) * 100}%"></div></div>
        <span class="rank-count">${cnt} (${Math.round((cnt / total) * 100)}%)</span>
      </div>
    `).join("");
}

// ─── Exportação CSV ───────────────────────────────────────────
document.getElementById("btnExportar")?.addEventListener("click", () => {
  const bairro = document.getElementById("filtroBairro").value;
  const zona   = document.getElementById("filtroZona").value;
  let dados    = todasRespostas;
  if (bairro) dados = dados.filter((r) => r.identificacao?.bairro === bairro);
  if (zona)   dados = dados.filter((r) => r.identificacao?.zona   === zona);

  if (!dados.length) { alert("Nenhum dado para exportar."); return; }

  const cabecalho = [
    "Nome","CPF","Idade","Sexo","Telefone","Email","Bairro","Zona","Perfil",
    "Prioridades","Necessidades","Sugestões de Obras","Observações",
    "Av.Saúde","Av.Educação","Av.Limpeza","Av.Iluminação",
    "Av.Transporte","Av.Segurança","Av.Infraestrutura","Av.Assistência Social",
    "Participou Antes","Considera Importante","Quer Receber Info","Data"
  ].join(";");

  const linhas = dados.map((r) => [
    r.identificacao?.nome       || "",
    r.identificacao?.cpf        || "",
    r.identificacao?.idade      || "",
    r.identificacao?.sexo       || "",
    r.identificacao?.telefone   || "",
    r.identificacao?.email      || "",
    r.identificacao?.bairro     || "",
    r.identificacao?.zona       || "",
    r.perfil                    || "",
    (r.prioridades  || []).join("|"),
    (r.necessidades || []).join("|"),
    r.sugestoes                 || "",
    r.observacoes               || "",
    r.avaliacoes?.saude         || "",
    r.avaliacoes?.educacao      || "",
    r.avaliacoes?.limpeza       || "",
    r.avaliacoes?.iluminacao    || "",
    r.avaliacoes?.transporte    || "",
    r.avaliacoes?.seguranca     || "",
    r.avaliacoes?.infraestrutura|| "",
    r.avaliacoes?.assistencia   || "",
    r.participacao?.participou  || "",
    r.participacao?.importante  || "",
    r.participacao?.receberInfo || "",
    r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString("pt-BR") : "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));

  const csv  = "\uFEFF" + [cabecalho, ...linhas].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `ldo_oriximina_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Botão atualizar ─────────────────────────────────────────
document.getElementById("btnAtualizar")?.addEventListener("click", carregarDados);

// ─── Loading helper ──────────────────────────────────────────
function mostrarLoading(show) {
  const loading  = document.getElementById("areaLoading");
  const conteudo = document.getElementById("areaConteudo");
  if (loading)  loading.style.display  = show ? "flex" : "none";
  if (conteudo) conteudo.style.display = show ? "none" : "block";
}

// ─── Inicializa ───────────────────────────────────────────────
carregarDados();